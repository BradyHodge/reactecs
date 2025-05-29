
## Prerequisites: Install Required Tools

### Install AWS CLI
**Windows:**
```powershell
winget install Amazon.AWSCLI
```

**macOS:**
```bash
brew install awscli
```

**Linux (Ubuntu/Debian):**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Install Docker
**Windows:**
```powershell
winget install Docker.DockerDesktop
```

**macOS:**
```bash
brew install --cask docker
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io
sudo usermod -aG docker $USER
```

### Configure AWS Credentials
```bash
aws configure set aws_access_key_id "your-access-key-id"
aws configure set aws_secret_access_key "your-secret-access-key"
aws configure set aws_session_token "your-session-token"
```
Enter your AWS Access Key ID, Secret Access Key, Default region (e.g., us-west-2), and Default output format (json).

### Verify Installation
```bash
aws --version
aws sts get-caller-identity
docker --version
docker run hello-world
```

## Step 1: Create Docker Configuration Files

### 1.1 Create Dockerfile
In your project root directory:
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 1.2 Create nginx.conf
```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
```

### 1.3 Create .dockerignore
```
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
.nyc_output
coverage
.vscode
```

## Step 2: Build and Test Docker Image Locally
```bash
# Build the Docker image
docker build -t react-bank-game .

# Test locally
docker run -p 3000:80 react-bank-game

# Visit http://localhost:3000 to test your app
```

## Step 3: Push Image to Amazon ECR

### 3.1 Create ECR Repository
```bash
aws ecr create-repository --repository-name react-bank-game --region us-west-2
```

### 3.2 Push to ECR

**Linux/macOS:**
```bash
AWS_REGION=us-west-2 && AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text) && ECR_REPOSITORY=react-bank-game && aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker tag react-bank-game:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest
```

**Windows PowerShell:**
```powershell
$AWS_REGION="us-west-2"; $AWS_ACCOUNT_ID=(aws sts get-caller-identity --query Account --output text); $ECR_REPOSITORY="react-bank-game"; aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker tag react-bank-game:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY`:latest"

docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY`:latest"
```

## Step 4: Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name react-app-cluster
```

## Step 5: Create Task Definition

### 5.1 Create task-definition.json
Replace `ACCOUNT-ID` with your actual AWS account ID:
```json
{
  "family": "react-bank-game-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT-ID:role/LabRole",
  "containerDefinitions": [
    {
      "name": "react-bank-game-container",
      "image": "ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/react-bank-game:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/react-bank-game-task",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 5.2 Create CloudWatch Log Group and Register Task Definition
```bash
# Create log group
aws logs create-log-group --log-group-name /ecs/react-bank-game-task --region us-west-2

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

## Step 6: Create ECS Service

First, get your default VPC subnets and create a security group:

**Linux/macOS:**
```bash
# Get default VPC
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

# Get subnets
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[0:2].SubnetId" --output text | tr '\t' ',')

# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name react-app-sg \
  --description "Security group for React app" \
  --vpc-id $VPC_ID \
  --query "GroupId" --output text)

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0
```

**Windows PowerShell:**
```powershell
# Get default VPC
$VPC_ID = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text

# Get subnets
$SUBNET_IDS = (aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[0:2].SubnetId" --output text) -replace "`t", ","

# Create security group
$SG_ID = aws ec2 create-security-group --group-name react-app-sg --description "Security group for React app" --vpc-id $VPC_ID --query "GroupId" --output text

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
```

Create the service:

**Linux/macOS:**
```bash
aws ecs create-service \
  --cluster react-app-cluster \
  --service-name react-bank-game-service \
  --task-definition react-bank-game-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}"
```

**Windows PowerShell:**
```powershell
aws ecs create-service --cluster react-app-cluster --service-name react-bank-game-service --task-definition react-bank-game-task --desired-count 1 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}"
```

## Step 7: Access Your Application

Get the public IP of your running task:

**Linux/macOS:**
```bash
# Get task ARN
TASK_ARN=$(aws ecs list-tasks --cluster react-app-cluster --service-name react-bank-game-service --query "taskArns[0]" --output text)

# Get task details and public IP
aws ecs describe-tasks --cluster react-app-cluster --tasks $TASK_ARN --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text | xargs -I {} aws ec2 describe-network-interfaces --network-interface-ids {} --query "NetworkInterfaces[0].Association.PublicIp" --output text
```

**Windows PowerShell:**
```powershell
# Get task ARN
$TASK_ARN = aws ecs list-tasks --cluster react-app-cluster --service-name react-bank-game-service --query "taskArns[0]" --output text

# Get network interface ID
$ENI_ID = aws ecs describe-tasks --cluster react-app-cluster --tasks $TASK_ARN --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value" --output text

# Get public IP
aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --query "NetworkInterfaces[0].Association.PublicIp" --output text
```

Visit the returned IP address in your browser.

## Step 8: Set Up Application Load Balancer (Optional)

For production deployments, use an Application Load Balancer:

**Linux/macOS:**
```bash
# Create ALB security group
ALB_SG=$(aws ec2 create-security-group \
  --group-name react-app-alb-sg \
  --description "Security group for React app ALB" \
  --vpc-id $VPC_ID \
  --query "GroupId" --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name react-app-alb \
  --subnets $(echo $SUBNET_IDS | tr ',' ' ') \
  --security-groups $ALB_SG \
  --query "LoadBalancers[0].LoadBalancerArn" --output text)

# Create target group
TG_ARN=$(aws elbv2 create-target-group \
  --name react-app-targets \
  --protocol HTTP \
  --port 80 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --query "TargetGroups[0].TargetGroupArn" --output text)

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Update service to use ALB
aws ecs update-service \
  --cluster react-app-cluster \
  --service react-bank-game-service \
  --load-balancers targetGroupArn=$TG_ARN,containerName=react-bank-game-container,containerPort=80
```

**Windows PowerShell:**
```powershell
# Create ALB security group
$ALB_SG = aws ec2 create-security-group --group-name react-app-alb-sg --description "Security group for React app ALB" --vpc-id $VPC_ID --query "GroupId" --output text

aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0

# Create ALB
$SUBNET_ARRAY = $SUBNET_IDS -split ","
$ALB_ARN = aws elbv2 create-load-balancer --name react-app-alb --subnets $SUBNET_ARRAY --security-groups $ALB_SG --query "LoadBalancers[0].LoadBalancerArn" --output text

# Create target group
$TG_ARN = aws elbv2 create-target-group --name react-app-targets --protocol HTTP --port 80 --vpc-id $VPC_ID --target-type ip --health-check-path / --query "TargetGroups[0].TargetGroupArn" --output text

# Create listener
aws elbv2 create-listener --load-balancer-arn $ALB_ARN --protocol HTTP --port 80 --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Update service to use ALB
aws ecs update-service --cluster react-app-cluster --service react-bank-game-service --load-balancers targetGroupArn=$TG_ARN,containerName=react-bank-game-container,containerPort=80
```

Get the ALB DNS name:

**Linux/macOS:**
```bash
aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query "LoadBalancers[0].DNSName" --output text
```

**Windows PowerShell:**
```powershell
aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --query "LoadBalancers[0].DNSName" --output text
```

## Useful Management Commands

### Update your application with a new Docker image:

**Linux/macOS:**
```bash
# Build and push new image
docker build -t react-bank-game .
docker tag react-bank-game:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

# Force new deployment
aws ecs update-service --cluster react-app-cluster --service react-bank-game-service --force-new-deployment
```

**Windows PowerShell:**
```powershell
# Build and push new image
docker build -t react-bank-game .
docker tag react-bank-game:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY`:latest"
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY`:latest"

# Force new deployment
aws ecs update-service --cluster react-app-cluster --service react-bank-game-service --force-new-deployment
```

### View logs:
```bash
aws logs describe-log-streams --log-group-name /ecs/react-bank-game-task
aws logs get-log-events --log-group-name /ecs/react-bank-game-task --log-stream-name [STREAM_NAME]
```

### Clean up resources:

**Linux/macOS:**
```bash
# Delete service
aws ecs update-service --cluster react-app-cluster --service react-bank-game-service --desired-count 0
aws ecs delete-service --cluster react-app-cluster --service react-bank-game-service

# Delete cluster
aws ecs delete-cluster --cluster react-app-cluster

# Delete ECR repository
aws ecr delete-repository --repository-name react-bank-game --force

# Delete ALB and target group (if created)
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
aws elbv2 delete-target-group --target-group-arn $TG_ARN

# Delete security groups
aws ec2 delete-security-group --group-id $SG_ID
aws ec2 delete-security-group --group-id $ALB_SG
```

**Windows PowerShell:**
```powershell
# Delete service
aws ecs update-service --cluster react-app-cluster --service react-bank-game-service --desired-count 0
aws ecs delete-service --cluster react-app-cluster --service react-bank-game-service

# Delete cluster
aws ecs delete-cluster --cluster react-app-cluster

# Delete ECR repository
aws ecr delete-repository --repository-name react-bank-game --force

# Delete ALB and target group (if created)
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
aws elbv2 delete-target-group --target-group-arn $TG_ARN

# Delete security groups
aws ec2 delete-security-group --group-id $SG_ID
aws ec2 delete-security-group --group-id $ALB_SG
```

## Troubleshooting

**Container fails to start:** Check CloudWatch logs in the ECS console or via CLI.

**Cannot access app:** Verify security group allows port 80 and the task has a public IP.

**502 Bad Gateway:** Ensure your container is listening on port 80.

**Image pull errors:** Verify ECR repository permissions and image URI in task definition.

**Permission errors:** Make sure you're using the correct IAM role (LabRole) and have necessary permissions.

## Key Differences Between Platforms

**PowerShell vs Bash:**
- Variables use `$variable` syntax in both, but PowerShell requires quotes around complex expressions
- PowerShell uses `-replace` instead of `tr` for text replacement
- PowerShell uses `-split` to convert strings to arrays
- Docker commands in PowerShell need backticks to escape colons in image tags
- PowerShell uses semicolons (`;`) instead of `&&` to chain commands
