# LocalStack Development Guide

This project includes full LocalStack support for local development and contract testing, allowing you to develop and test AWS services locally without incurring cloud costs.

## Quick Start

1. **Start Local Environment**:
   ```bash
   npm run local:start
   ```

2. **Deploy to LocalStack**:
   ```bash
   npm run local:deploy
   ```

3. **Run Tests**:
   ```bash
   npm run local:test
   ```

4. **Stop Environment**:
   ```bash
   npm run local:stop
   ```

## Available Commands

- `npm run local:start` - Start LocalStack and PostgreSQL
- `npm run local:stop` - Stop all local services
- `npm run local:deploy` - Deploy application to LocalStack
- `npm run local:destroy` - Remove deployment from LocalStack
- `npm run local:bootstrap` - Bootstrap CDK for LocalStack (first time only)
- `npm run local:test` - Run integration tests against local environment
- `npm run local:logs` - Show LocalStack logs
- `npm run local:reset` - Reset entire environment (clean restart)

## Services Included

### LocalStack
- **Port**: 4566
- **Services**: Lambda, API Gateway, CloudWatch, IAM, STS
- **Dashboard**: <http://localhost:4566>

### PostgreSQL
- **Port**: 5432
- **Database**: users_db
- **Username**: testuser
- **Password**: testpass

## Development Workflow

1. **Make Changes**: Edit your TypeScript code
2. **Test Locally**: 
   ```bash
   npm run build
   npm run local:deploy
   ```
3. **Run Integration Tests**:
   ```bash
   npm run test:integration
   ```
4. **Deploy to AWS** (when ready):
   ```bash
   npm run deploy
   ```

## Architecture Differences

### Local Development
- Uses PostgreSQL database instead of DSQL
- Simplified Lambda handlers without AWS SDK dependencies
- Real database persistence with test data
- Full API Gateway simulation

### Production
- Uses AWS DSQL (or fallback mock data)
- Full AWS integration with proper authentication
- CloudWatch monitoring and logging
- Real AWS infrastructure

## Troubleshooting

### Common Issues

1. **Docker not running**: Ensure Docker Desktop is started
2. **Port conflicts**: Check that ports 4566 and 5432 are available
3. **Permission errors**: Run `chmod +x scripts/local-dev.sh`
4. **CDK Local not found**: This project uses standard AWS CDK with LocalStack environment variables instead of `cdklocal`
5. **LocalStack Lambda warnings**: The project is configured for LocalStack v2.x with updated Lambda provider (deprecated settings removed)

### Debug Commands

```bash
# Check service status
docker compose ps

# View logs
npm run local:logs

# Connect to database
psql -h localhost -p 5432 -U testuser -d users_db

# Check LocalStack health
curl http://localhost:4566/health
```

## Benefits

- **Cost Effective**: No AWS charges during development
- **Fast Iteration**: Quick deploy and test cycles
- **Offline Development**: Work without internet connection
- **Contract Testing**: Verify AWS service interactions locally
- **CI/CD Integration**: Run tests in pipelines without AWS credentials
