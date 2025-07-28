# AWS Serverless User API

A TypeScript-based serverless REST API built with AWS CDK, Lambda functions, API Gateway, and DynamoDB for user management.

## 🎯 Features

- **RESTful API**: Create and retrieve users
- **Serverless Architecture**: AWS Lambda functions for scalability
- **DynamoDB Persistence**: NoSQL database for user data storage
- **TypeScript**: Full type safety with Effect library for functional programming
- **AWS CDK**: Infrastructure as Code for consistent deployments
- **Monitoring**: CloudWatch dashboards and logging
- **LocalStack Support**: Local development environment

## 🏗️ Architecture

```
API Gateway → Lambda Functions → DynamoDB
     ↓              ↓              ↓
   REST API    Business Logic   Data Storage
```

### Components

- **API Gateway**: REST API endpoints with CORS support
- **Lambda Functions**: 
  - `CreateUserFunction`: Handles POST /users
  - `GetUserFunction`: Handles GET /users/{id}
- **DynamoDB Table**: `users-table` with user data persistence
- **CloudWatch**: Monitoring dashboard and log aggregation

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS CDK CLI installed
- LocalStack (for local development)

### Local Development with LocalStack

LocalStack now uses DynamoDB (same as AWS deployment) for consistency:

```bash
# Start LocalStack with DynamoDB
npm run deploy:localstack

# Test the LocalStack API
curl -X POST http://localhost:4566/restapis/{api-id}/prod/_user_request_/users \
  -H "Content-Type: application/json" \
  -d '{"id": "user1", "name": "John Doe"}'

# Check LocalStack DynamoDB
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name users-table --region us-west-2 --no-cli-pager
```

### AWS Deployment

```bash
# Deploy to AWS
npm run deploy:aws

# Test the API (replace with your API Gateway URL)
curl -X POST https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/users \
  -H "Content-Type: application/json" \
  -d '{"id": "user1", "name": "John Doe"}'
```

## 📚 API Endpoints

### Create User
```http
POST /users
Content-Type: application/json

{
  "id": "user1",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "id": "user1",
  "name": "John Doe",
  "createdAt": "2025-07-26T01:08:34.747Z",
  "updatedAt": "2025-07-26T01:08:34.747Z"
}
```

### Get User
```http
GET /users/{id}
```

**Response:**
```json
{
  "id": "user1",
  "name": "John Doe",
  "createdAt": "2025-07-26T01:08:34.747Z",
  "updatedAt": "2025-07-26T01:08:34.747Z"
}
```

## 🧪 Testing

### Automated Deployment Testing
```bash
# Run comprehensive deployment tests
npm run test:all

# Test AWS deployment only
npm run test:deployment

# Test specific components
npm run test:deployment:check    # Health check only
npm run test:deployment:cleanup  # Clean up test data

# Performance testing
npm run test:all:performance
```

### Manual Testing
```bash
# Check deployment status
aws cloudformation describe-stacks --stack-name UserApiStack

# View DynamoDB data
aws dynamodb scan --table-name users-table --no-cli-pager

# Test API endpoints directly
curl -X POST https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/users \
  -H "Content-Type: application/json" \
  -d '{"id":"test1","name":"Test User"}'
```

## 📊 Monitoring

Access the CloudWatch dashboard: `UserAPI-Monitoring`

Monitor:
- Lambda function invocations and errors
- API Gateway request metrics
- DynamoDB read/write operations

## 🗂️ Project Structure

```
├── src/
│   ├── domain/           # Domain models and schemas
│   ├── infrastructure/   # Repository implementations
│   ├── services/         # Business logic services
│   └── lambda/           # Lambda function handlers
├── infrastructure/       # CDK stack definitions
├── archive/             # Archived implementations
│   └── dsql/           # Previous DSQL implementation
├── scripts/            # Deployment scripts
└── package.json
```

## 🔧 Technical Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Framework**: AWS CDK v2
- **Database**: Amazon DynamoDB
- **Compute**: AWS Lambda
- **API**: Amazon API Gateway
- **Monitoring**: Amazon CloudWatch
- **Local Dev**: LocalStack

## 📈 Performance

- **Cold Start**: ~300ms
- **Warm Start**: ~50ms
- **DynamoDB**: Sub-10ms read/write latency
- **Auto Scaling**: Lambda scales automatically

## 💰 Cost Optimization

- Pay-per-request DynamoDB billing
- Lambda charged per 100ms execution time
- API Gateway charges per request
- CloudWatch logs with 1-week retention

## 🛠️ Development

### Local Setup
```bash
npm install
npm run build
npm run deploy:localstack
```

### AWS Deployment
```bash
npm run deploy:aws
```

### Teardown
```bash
# LocalStack
npm run localstack:stop

# AWS
./scripts/deploy-aws.sh teardown
```

## 📝 Notes

### DSQL Implementation (Archived)

The project originally used Amazon Aurora DSQL for persistence but encountered connection authorization issues. The DSQL implementation has been archived in `archive/dsql/` and can be restored once the authentication issues are resolved.

**DSQL Issues Encountered:**
- "Access denied" errors despite proper IAM permissions
- Auth token generation working but connection rejected
- Both regular and admin auth tokens attempted

**Migration to DynamoDB:**
- Simplified architecture with native AWS SDK integration
- Immediate functionality and reliability
- Better suited for serverless workloads

### Future Enhancements

- Add user update and delete endpoints
- Implement user listing with pagination
- Add input validation and sanitization
- Set up automated testing pipeline
- Add API authentication (Cognito/API Keys)
- Implement caching with ElastiCache

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
