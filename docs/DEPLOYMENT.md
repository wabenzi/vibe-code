# Deployment Guide

## Prerequisites

1. **AWS CLI**: Configure your AWS credentials
   ```bash
   aws configure
   ```

2. **Node.js**: Version 18 or higher
3. **AWS CDK**: Install globally
   ```bash
   npm install -g aws-cdk
   ```

## Local Development with LocalStack

For local contract testing and development, you can use LocalStack to simulate AWS services locally.

### Prerequisites for Local Development

1. **Docker**: Install Docker Desktop
2. **LocalStack**: Install LocalStack CLI
   ```bash
   pip install localstack
   # or
   brew install localstack/tap/localstack-cli
   ```

3. **CDK**: AWS CDK is already included in the project dependencies
   ```bash
   npm install -g aws-cdk
   ```

### Local Development Setup

1. **Start LocalStack Services**:
   ```bash
   npm run local:start
   ```
   This will start:
   - LocalStack (simulating AWS services on port 4566)
   - PostgreSQL database (on port 5432)

2. **Bootstrap CDK for LocalStack** (First Time Only):
   ```bash
   npm run local:bootstrap
   ```

3. **Deploy to LocalStack**:
   ```bash
   npm run local:deploy
   ```
   
   **Note**: The deployment will automatically detect the LocalStack environment and use the appropriate configuration.

4. **Run Integration Tests**:
   ```bash
   npm run test:integration
   ```
   
   **Note**: Integration tests connect to the local PostgreSQL database and verify Effect error handling patterns.

5. **Stop LocalStack**:
   ```bash
   npm run local:stop
   ```

### Local API Testing

Once deployed to LocalStack, test the local API:

#### Get API Gateway URL
The deployment will output the API Gateway URL. Alternatively, find it with:
```bash
# List APIs
aws --endpoint-url=http://localhost:4566 --no-paginate --no-cli-pager apigateway get-rest-apis

# Get API details (replace {api-id} with actual ID)
aws --endpoint-url=http://localhost:4566 --no-paginate --no-cli-pager apigateway get-rest-api --rest-api-id {api-id}
```

#### Create a User (Local)
```bash
# Replace {api-id} with your actual API Gateway ID from deployment output
curl -X POST "http://localhost:4566/restapis/{api-id}/local/_user_request_/users" \
  -H "Content-Type: application/json" \
  -d '{"id": "local-user-1", "name": "Local Test User"}'
```

#### Get a User (Local)
```bash
curl "http://localhost:4566/restapis/{api-id}/local/_user_request_/users/local-user-1"
```

#### Test the Demo User
```bash
curl "http://localhost:4566/restapis/{api-id}/local/_user_request_/users/test"
```

### Helper Script Usage

Use the included helper script for easier development:

```bash
# Start everything
./scripts/local-dev.sh start

# Deploy to LocalStack
./scripts/local-dev.sh deploy

# Run integration tests
./scripts/local-dev.sh test

# View logs
./scripts/local-dev.sh logs

# Reset environment
./scripts/local-dev.sh reset

# Stop everything
./scripts/local-dev.sh stop
```

### Database Access

Connect to the local PostgreSQL database:
```bash
psql -h localhost -p 5432 -U testuser -d users_db
```
Password: `testpass`

## Production Deployment to AWS

## Production Deployment to AWS

### 1. Bootstrap CDK (First Time Only)
```bash
npm run bootstrap
```

### 2. Set Up DSQL Cluster

The application now includes **real DSQL integration** using PostgreSQL-compatible drivers with AWS authentication. To enable DSQL persistence:

1. Go to AWS Console > Aurora DSQL
2. Create a new cluster
3. Note the cluster ARN (format: `arn:aws:dsql:region:account:cluster/cluster-id`)
4. Set the environment variable before deployment:
   ```bash
   export DSQL_CLUSTER_ARN=arn:aws:dsql:us-west-2:123456789012:cluster/your-cluster-id
   ```

**Important**: If no DSQL cluster ARN is provided or the connection fails, the application will fall back to mock data for demonstration purposes. The test endpoint (`/users/test`) will always work regardless of DSQL configuration.

### 3. Deploy to AWS
```bash
# Make sure AWS environment variables are set for production
unset AWS_ENDPOINT_URL
npm run deploy
```

The deployment will output the API Gateway URL.

### 4. Test the Production API

Once deployed, you can test the endpoints:

#### Create a User
```bash
curl -X POST https://yz7ny3fa5b.execute-api.us-west-2.amazonaws.com/prod/users \
  -H "Content-Type: application/json" \
  -d '{"id": "user123", "name": "John Doe"}'
```

#### Get a User
```bash
curl https://yz7ny3fa5b.execute-api.us-west-2.amazonaws.com/prod/users/user123
```

#### Test the Demo User
```bash
curl https://yz7ny3fa5b.execute-api.us-west-2.amazonaws.com/prod/users/test
```

## Environment Variables

The following environment variables are available:

- `DSQL_CLUSTER_ARN`: ARN of your DSQL cluster
- `DSQL_DATABASE_NAME`: Database name (default: "users_db")
- `LOG_LEVEL`: Logging level (default: "INFO")

## Monitoring

After deployment, you can monitor your API through:

1. **CloudWatch Dashboard**: Look for "UserAPI-Monitoring" dashboard
2. **CloudWatch Logs**: Check `/aws/lambda/user-api` log group
3. **API Gateway Metrics**: Monitor request rates and errors

## Cleanup

To remove all resources:

```bash
npm run destroy
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure your AWS credentials have sufficient permissions for CDK deployment
2. **DSQL Connection**: Verify the DSQL cluster ARN is correctly set
3. **Build Errors**: Run `npm run build` to check for TypeScript compilation issues
4. **LocalStack Connection**: Ensure Docker is running and LocalStack is accessible on port 4566
5. **Database Connection**: Verify PostgreSQL is running and accessible (local development)
6. **CDK Version Issues**: This project uses standard AWS CDK v2.x with LocalStack environment variables instead of `cdklocal` to avoid compatibility issues
7. **LocalStack Lambda Warnings**: The configuration has been updated for LocalStack v2.x Lambda provider. Deprecated settings like `LAMBDA_EXECUTOR` and `LAMBDA_DOCKER_NETWORK` have been removed
8. **Integration Test Failures**: Tests use Effect TypeScript patterns with `Effect.runPromiseExit` for proper error handling. Tests create unique IDs to avoid database constraint violations
9. **AWS CLI Pagination**: AWS CLI v2 has two types of pagination that can interfere with scripts:
   - **Server-side pagination**: Controlled by `--no-paginate` flag 
   - **Client-side pager**: Controlled by `--no-cli-pager` flag or `AWS_PAGER` environment variable
   
   For automation and scripts, you need BOTH flags: `aws --no-paginate --no-cli-pager <command>`
   
   Alternatively, set the environment variable: `export AWS_PAGER=""`

### Debug Logs

#### Production (CloudWatch)
Check CloudWatch logs for detailed error information:
```bash
aws --no-paginate --no-cli-pager logs tail /aws/lambda/user-api --follow
```

#### Local Development
Check LocalStack logs:
```bash
docker logs localstack-main
```

Check PostgreSQL logs:
```bash
docker logs localstack-postgres
```

### Development Workflow

1. **Start Local Environment**: `npm run local:start`
2. **Run Tests**: `npm run test:integration` 
3. **Deploy Locally**: `npm run local:deploy`
4. **Test API Endpoints**: Use curl or Postman with LocalStack endpoints
5. **Deploy to Production**: `npm run deploy` (with AWS credentials)
6. **Stop Local Environment**: `npm run local:stop`

This workflow allows you to test your changes locally before deploying to AWS, reducing development costs and iteration time.

### AWS CLI Pagination Configuration

If you frequently work with scripts and want to permanently disable AWS CLI pagination, you can set this in your shell profile:

```bash
# Add to ~/.zshrc, ~/.bashrc, or ~/.bash_profile
export AWS_PAGER=""
```

This eliminates the need to add `--no-cli-pager` to every AWS CLI command in scripts.
