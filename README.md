# Complete Docker to AWS ECS Deployment Guide

## Prerequisites: Install Required Tools

### Install AWS CLI

#### Windows
```powershell
# Option 1: Download MSI installer
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi

# Option 2: Using winget (Windows Package Manager)
winget install Amazon.AWSCLI

# Option 3: Using Chocolatey
choco install awscli
```

#### macOS
```bash
# Option 1: Download PKG installer
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Option 2: Using Homebrew
brew install awscli

# Option 3: Using pip (if you have Python)
pip3 install awscli --upgrade --user
```

#### Linux
```bash
# Ubuntu/Debian
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Amazon Linux/CentOS/RHEL
sudo yum install awscli

# Using pip (cross-platform)
pip3 install awscli --upgrade --user
```

### Install AWS Tools for PowerShell (Windows/Cross-Platform)

#### PowerShell (Windows, macOS, Linux)
```powershell
# Install AWS Tools installer
Install-Module -Name AWS.Tools.Installer -Force

# Install specific AWS service modules
Install-AWSToolsModule EC2,S3,IAM,ECS,ECR

# Or install the complete module (larger download)
Install-Module -Name AWSPowerShell.NetCore -Force
```

#### Legacy Windows PowerShell 5.1
```powershell
Install-Module -Name AWSPowerShell -Force
```

### Install Docker

#### Windows
```powershell
# Download Docker Desktop from https://desktop.docker.com/win/stable/Docker%20Desktop%20Installer.exe
# Or using winget
winget install Docker.DockerDesktop

# Or using Chocolatey
choco install docker-desktop
```

#### macOS
```bash
# Download Docker Desktop from https://desktop.docker.com/mac/stable/Docker.dmg
# Or using Homebrew
brew install --cask docker
```

#### Linux (Ubuntu/Debian)
```bash
# Update package index
sudo apt-get update

# Install required packages
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io

# Add user to docker group (to run without sudo)
sudo usermod -aG docker $USER
```

#### Linux (CentOS/RHEL/Amazon Linux)
```bash
# Install Docker
sudo yum install docker

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
```

### Configure AWS Credentials

#### Using AWS CLI (Cross-Platform)
```bash
# Configure AWS credentials interactively
aws configure

# Or set environment variables (works on all platforms)
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_DEFAULT_REGION=us-west-2
```

#### Windows PowerShell/Command Prompt
```cmd
set AWS_ACCESS_KEY_ID=your-access-key-id
set AWS_SECRET_ACCESS_KEY=your-secret-access-key
set AWS_DEFAULT_REGION=us-west-2
```

#### Using PowerShell AWS Tools
```powershell
# Set AWS credentials in PowerShell
Set-AWSCredential -AccessKey "your-access-key-id" -SecretKey "your-secret-access-key" -StoreAs default

# Set default region
Set-DefaultAWSRegion -Region us-west-2
```

### Verify Installation

#### Test AWS CLI
```bash
aws --version
aws sts get-caller-identity
```

#### Test AWS PowerShell Tools
```powershell
Get-AWSPowerShellVersion
Get-STSCallerIdentity
```

#### Test Docker
```bash
docker --version
docker run hello-world
```

## Step 1: Create Docker Configuration Files

### 1.1 Create Dockerfile
In your project root directory, create a `Dockerfile`:

```dockerfile
# Use official Node.js runtime as base image
FROM node:18-alpine as build

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Use nginx to serve the built app
FROM nginx:alpine

# Copy built app from previous stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 1.2 Create nginx.conf
Create an `nginx.conf` file for serving your React app:

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
        
        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
```

### 1.3 Create .dockerignore
Create a `.dockerignore` file to exclude unnecessary files:

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

### 2.1 Build the Docker image

#### Cross-Platform Commands
```bash
# Navigate to your project directory
cd path/to/your/react-app

# Build the Docker image
docker build -t react-bank-game .

# For multi-platform builds (if deploying to different architectures)
docker buildx build --platform linux/amd64,linux/arm64 -t react-bank-game .
```

### 2.2 Test locally
```bash
# Run the container locally
docker run -p 3000:80 react-bank-game

# Visit http://localhost:3000 to test your app

# Run in detached mode
docker run -d -p 3000:80 --name react-app-test react-bank-game

# View logs
docker logs react-app-test

# Stop and remove container
docker stop react-app-test
docker rm react-app-test
```

## Step 3: Push Image to Amazon ECR

### 3.1 Create ECR Repository

#### Using AWS Console
1. Go to AWS Console → ECS → Amazon ECR → Repositories
2. Click "Create repository"
3. Repository name: `react-bank-game`
4. Leave other settings as default
5. Click "Create repository"

#### Using AWS CLI (Cross-Platform)
```bash
# Create ECR repository
aws ecr create-repository --repository-name react-bank-game --region us-west-2
```

#### Using PowerShell
```powershell
# Create ECR repository
New-ECRRepository -RepositoryName react-bank-game -Region us-west-2
```

### 3.2 Push to ECR

#### Using AWS CLI (Cross-Platform)
```bash
# Set variables (replace with your values)
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY=react-bank-game

# Get login token and authenticate Docker
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag your image
docker tag react-bank-game:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

# Push the image
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest
```

#### Windows Command Prompt
```cmd
# Set variables
set AWS_REGION=us-west-2
set AWS_ACCOUNT_ID=your-account-id
set ECR_REPOSITORY=react-bank-game

# Get login token and authenticate Docker
aws ecr get-login-password --region %AWS_REGION% | docker login --username AWS --password-stdin %AWS_ACCOUNT_ID%.dkr.ecr.%AWS_REGION%.amazonaws.com

# Tag and push
docker tag react-bank-game:latest %AWS_ACCOUNT_ID%.dkr.ecr.%AWS_REGION%.amazonaws.com/%ECR_REPOSITORY%:latest
docker push %AWS_ACCOUNT_ID%.dkr.ecr.%AWS_REGION%.amazonaws.com/%ECR_REPOSITORY%:latest
```

#### PowerShell
```powershell
# Set variables
$AWS_REGION = "us-west-2"
$AWS_ACCOUNT_ID = (Get-STSCallerIdentity).Account
$ECR_REPOSITORY = "react-bank-game"

# Get login token and authenticate Docker
$LoginToken = Get-ECRLoginCommand -Region $AWS_REGION
Invoke-Expression $LoginToken.Command

# Tag and push
docker tag react-bank-game:latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest"
```

## Step 4: Create ECS Cluster

### 4.1 Create Cluster

#### Using AWS Console
1. Go to AWS Console → ECS → Clusters
2. Click "Create Cluster"
3. Choose "AWS Fargate (serverless)"
4. Cluster name: `react-app-cluster`
5. Click "Create"

#### Using AWS CLI
```bash
aws ecs create-cluster --cluster-name react-app-cluster
```

#### Using PowerShell
```powershell
New-ECSCluster -ClusterName react-app-cluster
```

## Step 5: Create Task Definition

### 5.1 Create Task Definition JSON File

Create a file named `task-definition.json`:

```json
{
  "family": "react-bank-game-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT-ID:role/ecsTaskExecutionRole",
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

### 5.2 Register Task Definition

#### Create CloudWatch Log Group First
```bash
# AWS CLI
aws logs create-log-group --log-group-name /ecs/react-bank-game-task --region us-west-2
```

```powershell
# PowerShell
New-CWLLogGroup -LogGroupName "/ecs/react-bank-game-task" -Region us-west-2
```

#### Register Task Definition
```bash
# AWS CLI (update ACCOUNT-ID in the JSON file first)
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

```powershell
# PowerShell
$TaskDefinition = Get-Content -Path "task-definition.json" -Raw | ConvertFrom-Json
Register-ECSTaskDefinition -TaskDefinition $TaskDefinition
```

## Step 6: Create ECS Service

### 6.1 Create Service

#### Using AWS Console
1. Go to your cluster → Services tab
2. Click "Create"
3. Configure:
   - **Launch type**: Fargate
   - **Task Definition**: Select your task definition
   - **Service name**: `react-bank-game-service`
   - **Number of tasks**: 1
   - **Minimum healthy percent**: 50
   - **Maximum percent**: 200

#### Using AWS CLI
```bash
# Create service JSON configuration
cat > service-definition.json << EOF
{
  "serviceName": "react-bank-game-service",
  "cluster": "react-app-cluster",
  "taskDefinition": "react-bank-game-task",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": [
        "subnet-xxxxxxxxx",
        "subnet-yyyyyyyyy"
      ],
      "securityGroups": [
        "sg-xxxxxxxxx"
      ],
      "assignPublicIp": "ENABLED"
    }
  }
}
EOF

# Create the service
aws ecs create-service --cli-input-json file://service-definition.json
```

## Step 7: Access Your Application

### 7.1 Find Public IP
1. Go to your ECS service
2. Click on the running task
3. Note the "Public IP" address
4. Visit `http://PUBLIC-IP` in your browser

### 7.2 Using Command Line to Get Public IP

#### AWS CLI
```bash
# Get running tasks
aws ecs list-tasks --cluster react-app-cluster --service-name react-bank-game-service

# Get task details (replace TASK-ARN with actual ARN)
aws ecs describe-tasks --cluster react-app-cluster --tasks TASK-ARN
```

#### PowerShell
```powershell
# Get running tasks
$Tasks = Get-ECSTask -Cluster react-app-cluster -ServiceName react-bank-game-service

# Get task details
Get-ECSTaskDetail -Cluster react-app-cluster -Task $Tasks[0].TaskArn
```

## Step 8: Set Up Application Load Balancer (Recommended)

### 8.1 Create Application Load Balancer

#### Using AWS CLI
```bash
# Get default VPC and subnets
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[].SubnetId" --output text)

# Create security group for ALB
ALB_SG=$(aws ec2 create-security-group \
  --group-name react-app-alb-sg \
  --description "Security group for React app ALB" \
  --vpc-id $VPC_ID \
  --query "GroupId" --output text)

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name react-app-alb \
  --subnets $SUBNET_IDS \
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
```

## Step 9: Update Service to Use Load Balancer

### 9.1 Update Service Configuration

#### Create updated service definition
```bash
cat > service-update.json << EOF
{
  "cluster": "react-app-cluster",
  "service": "react-bank-game-service",
  "taskDefinition": "react-bank-game-task",
  "desiredCount": 1,
  "loadBalancers": [
    {
      "targetGroupArn": "$TG_ARN",
      "containerName": "react-bank-game-container",
      "containerPort": 80
    }
  ],
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxxxxxxxx", "subnet-yyyyyyyyy"],
      "securityGroups": ["sg-xxxxxxxxx"],
      "assignPublicIp": "ENABLED"
    }
  }
}
EOF

# Update service
aws ecs update-service --cli-input-json file://service-update.json
```

## Step 10: Monitoring and Scaling

### 10.1 CloudWatch Monitoring
- ECS automatically sends metrics to CloudWatch
- Monitor CPU, memory, and network utilization
- Set up alarms for high resource usage

### 10.2 Auto Scaling

#### Using AWS CLI
```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/react-app-cluster/react-bank-game-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 5

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/react-app-cluster/react-bank-game-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name react-app-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

Create `scaling-policy.json`:
```json
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
  },
  "ScaleOutCooldown": 300,
  "ScaleInCooldown": 300
}
```

## Troubleshooting

### Common Issues:
1. **Container fails to start**: Check CloudWatch logs in ECS console
2. **Cannot access app**: Verify security group allows port 80
3. **502 Bad Gateway**: Check if container is listening on port 80
4. **Image pull errors**: Verify ECR permissions and image URI
