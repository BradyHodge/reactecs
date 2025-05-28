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
```bash
# Navigate to your project directory
cd path/to/your/react-app

# Build the Docker image
docker build -t react-bank-game .
```

### 2.2 Test locally
```bash
# Run the container locally
docker run -p 3000:80 react-bank-game

# Visit http://localhost:3000 to test your app
```

## Step 3: Push Image to Amazon ECR

### 3.1 Create ECR Repository
1. Go to AWS Console → ECS → Amazon ECR → Repositories
2. Click "Create repository"
3. Repository name: `react-bank-game`
4. Leave other settings as default
5. Click "Create repository"

### 3.2 Configure AWS CLI
```bash
# Install AWS CLI if not already installed
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials (use your AWS Access Key and Secret)
aws configure
```

### 3.3 Push to ECR
```bash
# Get login token (replace REGION and ACCOUNT-ID)
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com

# Tag your image
docker tag react-bank-game:latest ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/react-bank-game:latest

# Push the image
docker push ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/react-bank-game:latest
```

## Step 4: Create ECS Cluster

### 4.1 Create Cluster
1. Go to AWS Console → ECS → Clusters
2. Click "Create Cluster"
3. Choose "AWS Fargate (serverless)"
4. Cluster name: `react-app-cluster`
5. Click "Create"

## Step 5: Create Task Definition

### 5.1 Create Task Definition
1. Go to ECS → Task Definitions
2. Click "Create new Task Definition"
3. Choose "AWS Fargate"
4. Configure:
   - **Task Definition Name**: `react-bank-game-task`
   - **Task Role**: Leave empty (or create if needed)
   - **Task Execution Role**: `ecsTaskExecutionRole`
   - **Task Memory**: 512 MB
   - **Task CPU**: 256 CPU units

### 5.2 Add Container
1. Click "Add container"
2. Configure:
   - **Container name**: `react-bank-game-container`
   - **Image**: `ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/react-bank-game:latest`
   - **Memory Limits**: Soft limit 512
   - **Port mappings**: Container port 80, Protocol TCP
3. Click "Add"
4. Click "Create"

## Step 6: Create ECS Service

### 6.1 Create Service
1. Go to your cluster → Services tab
2. Click "Create"
3. Configure:
   - **Launch type**: Fargate
   - **Task Definition**: Select your task definition
   - **Service name**: `react-bank-game-service`
   - **Number of tasks**: 1
   - **Minimum healthy percent**: 50
   - **Maximum percent**: 200

### 6.2 Configure Network
1. **Cluster VPC**: Select default VPC
2. **Subnets**: Select available subnets
3. **Security groups**: Create new security group
   - **Name**: `react-app-sg`
   - **Allow HTTP traffic**: Port 80 from 0.0.0.0/0
4. **Auto-assign public IP**: ENABLED

### 6.3 Configure Load Balancer (Optional but Recommended)
1. **Load balancer type**: Application Load Balancer
2. **Name**: `react-app-alb`
3. **Listener port**: 80
4. **Target group name**: `react-app-targets`
5. **Health check path**: `/`

## Step 7: Access Your Application

### 7.1 Find Public IP
1. Go to your ECS service
2. Click on the running task
3. Note the "Public IP" address
4. Visit `http://PUBLIC-IP` in your browser

### 7.2 If using Load Balancer
1. Go to EC2 → Load Balancers
2. Find your ALB and copy the DNS name
3. Visit the DNS name in your browser

## Step 8: Set Up Custom Domain (Optional)

### 8.1 Configure Route 53
1. Go to Route 53 → Hosted zones
2. Select your domain
3. Create new record:
   - **Name**: Leave empty for root domain or enter subdomain
   - **Type**: A - IPv4 address
   - **Alias**: Yes
   - **Alias target**: Select your ALB

### 8.2 Add HTTPS with Certificate Manager
1. Go to Certificate Manager
2. Request a certificate for your domain
3. Update your ALB to use HTTPS listener with the certificate

## Step 9: Monitoring and Scaling

### 9.1 CloudWatch Monitoring
- ECS automatically sends metrics to CloudWatch
- Monitor CPU, memory, and network utilization
- Set up alarms for high resource usage

### 9.2 Auto Scaling
1. Go to your ECS service
2. Update service → Auto Scaling tab
3. Configure:
   - **Minimum capacity**: 1
   - **Desired capacity**: 1
   - **Maximum capacity**: 5
4. Add scaling policies based on CPU or memory

## Benefits of Docker Deployment

1. **Consistency**: Same environment across development, staging, and production
2. **Scalability**: Easy horizontal scaling with ECS
3. **Resource Efficiency**: Better resource utilization than VMs
4. **Easy Updates**: Rolling deployments with zero downtime
5. **Isolation**: Applications run in isolated containers
6. **Portability**: Can run anywhere Docker is supported

## Cost Considerations

- **Fargate**: Pay for vCPU and memory resources used
- **ALB**: ~$16/month + data processing charges
- **ECR**: $0.10 per GB-month for storage
- **Route 53**: $0.50 per hosted zone per month
- **Certificate Manager**: Free for ACM certificates

## Troubleshooting

### Common Issues:
1. **Container fails to start**: Check CloudWatch logs in ECS console
2. **Cannot access app**: Verify security group allows port 80
3. **502 Bad Gateway**: Check if container is listening on port 80
4. **Image pull errors**: Verify ECR permissions and image URI

### Useful Commands:
```bash
# View ECS service logs
aws logs describe-log-groups --log-group-name-prefix /ecs/react-bank-game-task

# Update service with new image
aws ecs update-service --cluster react-app-cluster --service react-bank-game-service --force-new-deployment
```