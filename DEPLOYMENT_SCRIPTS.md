# Deployment Scripts

This project includes simplified deployment scripts for both LocalStack and AWS environments.

## Quick Start

### LocalStack (Development)
```bash
# Deploy to LocalStack
npm run deploy:localstack

# Check status
npm run deploy:localstack:status

# Teardown
npm run deploy:localstack:teardown
```

### AWS (Production)
```bash
# Deploy to AWS
npm run deploy:aws

# Check status  
npm run deploy:aws:status

# Teardown
npm run deploy:aws:teardown
```

## Script Features

### LocalStack Script (`scripts/deploy-localstack.sh`)
- 🐳 **Docker Management**: Automatic LocalStack container health checks
- 🔄 **Service Restart**: Smart restart logic with health verification
- 🏗️ **CDK Bootstrap**: Automatic CDK bootstrapping for LocalStack
- 📊 **Status Monitoring**: Real-time service status and endpoint information
- 🧹 **Clean Teardown**: Complete resource cleanup with container management

**Commands:**
- `deploy` - Full deployment with health checks
- `teardown` - Complete cleanup including Docker containers
- `restart` - Smart restart with health verification
- `status` - Service status and endpoint information

### AWS Script (`scripts/deploy-aws.sh`)
- ☁️ **AWS Environment**: Automatic AWS credential verification
- 🔧 **CDK Bootstrap**: Conditional CDK bootstrapping
- 🏗️ **Stack Management**: Complete stack lifecycle management
- 📈 **Cost Awareness**: Cost monitoring reminders and optimization tips
- 🔍 **Deployment Diff**: Preview changes before deployment

**Commands:**
- `deploy` - Full AWS deployment with bootstrap
- `teardown` - Infrastructure cleanup (keeps CDK bootstrap)
- `redeploy` - Quick redeploy without bootstrap
- `status` - Stack status and outputs
- `diff` - Preview deployment changes

## Environment Variables

### LocalStack
- All LocalStack environment variables are automatically set by the script
- No manual configuration required

### AWS
- `DSQL_CLUSTER_ARN` - Optional DSQL cluster ARN for persistence
- Standard AWS credentials via `aws configure` or IAM roles

## Examples

### Development Workflow
```bash
# Start development environment
npm run deploy:localstack

# Test your changes
curl http://localhost:4566/restapis/.../test/users

# Quick restart after code changes
./scripts/deploy-localstack.sh restart

# Check logs and status
npm run deploy:localstack:status
```

### Production Deployment
```bash
# Set up DSQL cluster (optional)
export DSQL_CLUSTER_ARN="arn:aws:dsql:us-west-2:123456789012:cluster/my-cluster"

# Deploy to AWS
npm run deploy:aws

# Monitor deployment
npm run deploy:aws:status

# Check what would change
./scripts/deploy-aws.sh diff
```

### Clean Teardown
```bash
# Remove everything from LocalStack
npm run deploy:localstack:teardown

# Remove AWS infrastructure
npm run deploy:aws:teardown
```

## Troubleshooting

### LocalStack Issues
- **Container not starting**: Check Docker is running and ports 4566, 4571 are available
- **CDK bootstrap fails**: Run `./scripts/deploy-localstack.sh restart` to reset environment
- **API not responding**: Check `npm run deploy:localstack:status` for service health

### AWS Issues  
- **Credentials error**: Run `aws configure` or check IAM role permissions
- **Bootstrap required**: Script will automatically bootstrap if needed
- **Region mismatch**: Ensure `aws configure get region` matches your desired region

### General Tips
- Use `npm run deploy:localstack:status` or `npm run deploy:aws:status` to diagnose issues
- Check CloudWatch logs for Lambda function errors
- Verify API Gateway endpoints are accessible
- For cost optimization, teardown environments when not in use

## Migration Between Environments

### LocalStack → AWS
1. Test thoroughly in LocalStack
2. Commit your changes
3. Run `npm run deploy:aws` 
4. Verify endpoints and functionality
5. Update environment-specific configurations as needed

### AWS → LocalStack  
1. Ensure LocalStack containers are running
2. Run `npm run deploy:localstack`
3. Test with LocalStack endpoints (port 4566)
4. Debug any LocalStack-specific compatibility issues
