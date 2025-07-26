# LocalStack DynamoDB Setup

This document describes the LocalStack infrastructure that uses DynamoDB for local development, providing consistency with the AWS production environment.

## Architecture

### LocalStack Components
- **DynamoDB**: Local DynamoDB instance (same schema as AWS)
- **API Gateway**: REST API endpoints
- **Lambda Functions**: Business logic with DynamoDB integration
- **CloudWatch**: Monitoring and logging

### Key Differences from AWS Deployment
1. **Endpoint**: Uses `http://localhost:4566` for DynamoDB
2. **Credentials**: Uses test credentials (`test`/`test`)
3. **Lambda Functions**: Specialized LocalStack handlers with explicit endpoint configuration

## Files Structure

### Infrastructure
- `infrastructure/local-user-api-stack.ts` - LocalStack CDK stack with DynamoDB
- `bin/local-app.ts` - CDK app that deploys LocalStack stack

### Application Layer
- `src/infrastructure/local-dynamo-user-repository.ts` - LocalStack DynamoDB repository
- `src/services/local-dynamo-user-service.ts` - LocalStack-specific business logic
- `src/lambda/create-user-localstack.ts` - Create user Lambda for LocalStack
- `src/lambda/get-user-localstack.ts` - Get user Lambda for LocalStack

### Configuration
- Environment variables configured for LocalStack endpoints
- DynamoDB table name: `users-table`
- AWS region: `us-west-2`
- LocalStack endpoint: `http://localhost:4566`

## Deployment

### Start LocalStack
```bash
npm run deploy:localstack
```

This will:
1. Start LocalStack container with DynamoDB service
2. Bootstrap CDK for LocalStack
3. Deploy the complete infrastructure
4. Create the DynamoDB table
5. Deploy Lambda functions with LocalStack configuration

### Test LocalStack API
```bash
# Create a user
curl -X POST http://localhost:4566/restapis/{api-id}/prod/_user_request_/users \
  -H "Content-Type: application/json" \
  -d '{"id": "test1", "name": "Test User"}'

# Get a user  
curl -X GET http://localhost:4566/restapis/{api-id}/prod/_user_request_/users/test1

# Check DynamoDB directly
aws --endpoint-url=http://localhost:4566 dynamodb scan \
  --table-name users-table --region us-west-2 --no-cli-pager
```

### Run LocalStack Tests
```bash
npm run test:localstack
```

## Configuration Details

### Environment Variables (LocalStack)
```typescript
DYNAMODB_ENDPOINT=http://localhost:4566
DYNAMODB_TABLE_NAME=users-table
AWS_REGION=us-west-2
NODE_ENV=local
LOG_LEVEL=DEBUG
```

### DynamoDB Client Configuration
```typescript
const client = new DynamoDBClient({
  region: 'us-west-2',
  endpoint: 'http://localhost:4566',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test'
  }
})
```

## Troubleshooting

### Common Issues

1. **LocalStack not running**
   ```bash
   # Check LocalStack status
   curl http://localhost:4566/health
   
   # Restart LocalStack
   npm run deploy:localstack teardown
   npm run deploy:localstack
   ```

2. **DynamoDB table not found**
   ```bash
   # List tables in LocalStack
   aws --endpoint-url=http://localhost:4566 dynamodb list-tables --region us-west-2
   
   # Redeploy infrastructure
   npm run local:deploy
   ```

3. **Lambda function errors**
   ```bash
   # Check CloudWatch logs in LocalStack
   aws --endpoint-url=http://localhost:4566 logs describe-log-groups --region us-west-2
   ```

### Benefits of DynamoDB LocalStack

1. **Consistency**: Same database technology as production
2. **Fast Development**: No external database dependencies
3. **Testing**: Full integration testing with real DynamoDB operations
4. **Schema Validation**: Same table structure as AWS deployment

## Migration from PostgreSQL

The previous LocalStack setup used PostgreSQL. The new setup uses DynamoDB for:
- **Better AWS compatibility**: Same database as production
- **Simplified setup**: No separate PostgreSQL container needed
- **Consistent testing**: Same persistence layer as AWS
- **Performance**: DynamoDB local is faster for development

### Archived Files
Previous PostgreSQL-based files are archived in `archive/dsql/`:
- `create-user-local.ts`
- `get-user-local.ts` 
- `local-user-repository.ts`
- `local-user-repository-new.ts`
