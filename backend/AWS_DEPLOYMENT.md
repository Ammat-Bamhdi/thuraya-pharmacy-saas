# Thurayya Pharmacy Backend - AWS Elastic Beanstalk Deployment

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │  Elastic        │    │  RDS            │    │  Secrets    │  │
│  │  Beanstalk      │───▶│  PostgreSQL     │    │  Manager    │  │
│  │  (.NET 10)      │    │                 │    │             │  │
│  └────────┬────────┘    └─────────────────┘    └──────┬──────┘  │
│           │                                           │          │
│           │              ┌─────────────────┐          │          │
│           └──────────────│  IAM Role       │◀─────────┘          │
│                          │  (EB Instance)  │                     │
│                          └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- AWS CLI installed and configured (`aws --version`)
- EB CLI installed (`pip install awsebcli`)
- .NET 10 SDK
- AWS Account with appropriate permissions

## 🔐 Step 1: Create AWS Secrets Manager Secret

Store all sensitive configuration in AWS Secrets Manager. **NEVER commit secrets to Git!**

### Create the secret via AWS CLI:

```bash
aws secretsmanager create-secret \
  --name "thuraya-pharmacy/production" \
  --description "Thurayya Pharmacy API secrets" \
  --secret-string '{
    "ConnectionStrings__DefaultConnection": "Host=your-rds-endpoint.region.rds.amazonaws.com;Database=thurayya_pharmacy;Username=postgres;Password=YOUR_DB_PASSWORD",
    "Jwt__Key": "YOUR_PRODUCTION_JWT_SECRET_KEY_MINIMUM_32_CHARACTERS_LONG!",
    "Google__ClientId": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "Google__ClientSecret": "YOUR_GOOGLE_CLIENT_SECRET"
  }' \
  --region us-east-1
```

### Or via AWS Console:

1. Go to **AWS Secrets Manager** → **Store a new secret**
2. Choose **Other type of secret**
3. Add key-value pairs:
   | Key | Value |
   |-----|-------|
   | `ConnectionStrings__DefaultConnection` | `Host=xxx.rds.amazonaws.com;Database=thurayya_pharmacy;...` |
   | `Jwt__Key` | `your-32-char-minimum-secret-key` |
   | `Google__ClientId` | `xxx.apps.googleusercontent.com` |
   | `Google__ClientSecret` | `GOCSPX-xxx` |

4. Name the secret: `thuraya-pharmacy/production`

## 🗄️ Step 2: Create RDS PostgreSQL Database

### Via AWS CLI:

```bash
# Create a DB subnet group (if not exists)
aws rds create-db-subnet-group \
  --db-subnet-group-name thuraya-pharmacy-subnet \
  --db-subnet-group-description "Subnet for Thurayya Pharmacy DB" \
  --subnet-ids subnet-xxx subnet-yyy

# Create PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier thuraya-pharmacy-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.3 \
  --master-username postgres \
  --master-user-password "YOUR_STRONG_PASSWORD" \
  --allocated-storage 20 \
  --storage-type gp3 \
  --db-name thurayya_pharmacy \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name thuraya-pharmacy-subnet \
  --publicly-accessible false \
  --backup-retention-period 7 \
  --region us-east-1
```

### Via AWS Console:

1. Go to **RDS** → **Create database**
2. Choose **PostgreSQL**
3. Select **Free tier** or **Production** template
4. Settings:
   - DB instance identifier: `thuraya-pharmacy-db`
   - Master username: `postgres`
   - Master password: (use a strong password, store in Secrets Manager)
5. Instance configuration: `db.t3.micro` (free tier) or larger
6. Storage: 20 GB gp3
7. Connectivity:
   - VPC: Same VPC as Elastic Beanstalk
   - Public access: **No** (security best practice)
8. Database name: `thurayya_pharmacy`

**Note the endpoint** after creation (e.g., `thuraya-pharmacy-db.xxxx.us-east-1.rds.amazonaws.com`)

## 🔑 Step 3: Create IAM Role for Elastic Beanstalk

The EB instance needs permission to read from Secrets Manager.

### Create IAM Policy:

```bash
aws iam create-policy \
  --policy-name ThurayyaPharmacySecretsAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ],
        "Resource": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:thuraya-pharmacy/*"
      }
    ]
  }'
```

### Attach to EB Instance Role:

```bash
aws iam attach-role-policy \
  --role-name aws-elasticbeanstalk-ec2-role \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/ThurayyaPharmacySecretsAccess
```

## 🚀 Step 4: Initialize Elastic Beanstalk

```bash
# Navigate to backend folder
cd backend

# Initialize EB (first time only)
eb init

# Follow prompts:
# - Region: us-east-1 (or your preferred region)
# - Application name: thuraya-pharmacy-api
# - Platform: .NET 10 on Amazon Linux 2023
# - CodeCommit: No
# - SSH: Yes (recommended for debugging)
```

## ⚙️ Step 5: Create Environment with Configuration

```bash
# Create production environment
eb create production \
  --instance_type t3.small \
  --database.engine postgres \
  --envvars ASPNETCORE_ENVIRONMENT=Production,AWS_SECRET_NAME=thuraya-pharmacy/production,AWS_REGION=us-east-1
```

### Or with more options:

```bash
eb create production \
  --instance_type t3.small \
  --single \
  --envvars "ASPNETCORE_ENVIRONMENT=Production,AWS_SECRET_NAME=thuraya-pharmacy/production,AWS_REGION=us-east-1" \
  --tags "Project=ThurayyaPharmacy,Environment=Production"
```

## 📝 Step 6: Configure Environment Variables (Alternative to CLI)

Via AWS Console:

1. Go to **Elastic Beanstalk** → **Your Environment** → **Configuration**
2. Under **Software**, click **Edit**
3. Add Environment properties:

| Property | Value |
|----------|-------|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `AWS_SECRET_NAME` | `thuraya-pharmacy/production` |
| `AWS_REGION` | `us-east-1` |

## 📦 Step 7: Deploy Application

### Option A: Deploy via EB CLI

```bash
# From backend folder
dotnet publish src/ThurayyaPharmacy.API -c Release -o ./publish

# Deploy
eb deploy production
```

### Option B: Deploy via ZIP file

```bash
# Build and package
dotnet publish src/ThurayyaPharmacy.API -c Release -o ./publish
cd publish
zip -r ../deploy.zip .
cd ..

# Upload via AWS Console or CLI
aws elasticbeanstalk create-application-version \
  --application-name thuraya-pharmacy-api \
  --version-label v1.0.0 \
  --source-bundle S3Bucket=your-bucket,S3Key=deploy.zip

aws elasticbeanstalk update-environment \
  --environment-name production \
  --version-label v1.0.0
```

## 🔄 Step 8: Run Database Migrations

After first deployment, run EF Core migrations:

```bash
# SSH into the EB instance
eb ssh production

# Or use AWS Systems Manager Session Manager
aws ssm start-session --target i-xxxx

# Run migrations (from app directory)
cd /var/app/current
dotnet ef database update --project ThurayyaPharmacy.API.dll
```

**Better approach**: Run migrations as part of CI/CD pipeline before deployment.

## 🔒 Security Checklist

- [x] **Secrets in AWS Secrets Manager** - Never in code or config files
- [x] **RDS not publicly accessible** - Only accessible within VPC
- [x] **IAM least privilege** - EB role only has required permissions
- [x] **HTTPS enforced** - Configure via `.ebextensions` or load balancer
- [x] **Security groups configured** - EB can reach RDS, limited ingress
- [ ] **Enable AWS WAF** - For production, add web application firewall
- [ ] **Enable CloudWatch Logs** - For monitoring and alerting
- [ ] **Enable RDS encryption** - At-rest encryption for database

## 🌐 Step 9: Configure HTTPS (SSL/TLS)

### Option A: Use AWS Certificate Manager (Recommended)

1. Go to **AWS Certificate Manager**
2. Request a public certificate for your domain
3. Validate via DNS or Email
4. In Elastic Beanstalk → Configuration → Load Balancer:
   - Add HTTPS listener on port 443
   - Select the ACM certificate

### Option B: Use .ebextensions

Create `.ebextensions/https.config`:

```yaml
option_settings:
  aws:elb:listener:443:
    ListenerProtocol: HTTPS
    SSLCertificateId: arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/xxx
    InstancePort: 80
    InstanceProtocol: HTTP
```

## 📊 Monitoring & Logging

### Enable Enhanced Health Monitoring

```bash
eb config production
# Set:
# aws:elasticbeanstalk:healthreporting:system:
#   SystemType: enhanced
```

### View Logs

```bash
# View recent logs
eb logs

# Download all logs
eb logs --all
```

### CloudWatch Logs

Add to `.ebextensions/cloudwatch.config`:

```yaml
option_settings:
  aws:elasticbeanstalk:cloudwatch:logs:
    StreamLogs: true
    DeleteOnTerminate: false
    RetentionInDays: 30
```

## 💰 Cost Estimation

| Resource | Specification | Monthly Cost (USD) |
|----------|--------------|-------------------|
| Elastic Beanstalk (t3.small) | 1 instance | ~$15 |
| RDS PostgreSQL (db.t3.micro) | 20GB, single-AZ | ~$13 |
| Secrets Manager | 1 secret | ~$0.40 |
| Data Transfer | ~10GB | ~$1 |
| **Total** | | **~$30/month** |

*Costs may vary by region. Free tier eligible for first 12 months.*

## 🆘 Troubleshooting

### Application won't start

```bash
# Check logs
eb logs

# Common issues:
# 1. Missing environment variables
# 2. Can't connect to RDS (check security groups)
# 3. Secrets Manager access denied (check IAM role)
```

### Database connection failed

1. Verify RDS security group allows traffic from EB security group
2. Check connection string format in Secrets Manager
3. Ensure RDS is in same VPC as EB

### Secrets not loading

1. Verify `AWS_SECRET_NAME` environment variable is set
2. Check IAM role has `secretsmanager:GetSecretValue` permission
3. Verify secret name matches exactly (case-sensitive)

## 🔄 CI/CD with GitHub Actions

Create `.github/workflows/deploy-aws.yml`:

```yaml
name: Deploy to AWS Elastic Beanstalk

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'
      
      - name: Publish
        run: |
          cd backend
          dotnet publish src/ThurayyaPharmacy.API -c Release -o ./publish
      
      - name: Create deployment package
        run: |
          cd backend/publish
          zip -r ../deploy.zip .
      
      - name: Deploy to EB
        uses: einaregilsson/beanstalk-deploy@v22
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: thuraya-pharmacy-api
          environment_name: production
          region: us-east-1
          version_label: ${{ github.sha }}
          deployment_package: backend/deploy.zip
```

**Add GitHub Secrets**:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## Quick Reference

| Task | Command |
|------|---------|
| View environment status | `eb status` |
| SSH into instance | `eb ssh production` |
| View logs | `eb logs` |
| Deploy update | `eb deploy production` |
| Open in browser | `eb open` |
| Terminate environment | `eb terminate production` |

