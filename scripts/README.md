# Deployment Testing Guide

This directory contains comprehensive deployment testing scripts for the AWS Serverless User API.

## Test Scripts Overview

### 1. `test-deployment.sh` - AWS Deployment Testing
Tests the deployed AWS infrastructure with real API calls and DynamoDB verification.

**Features:**
- ✅ Checks CloudFormation stack status
- ✅ Validates API Gateway endpoints
- ✅ Creates and retrieves test users
- ✅ Verifies DynamoDB persistence
- ✅ Tests error handling
- ✅ Automatic cleanup of test data

**Usage:**
```bash
# Run full deployment test
./scripts/test-deployment.sh test
# or
npm run test:deployment

# Health check only
./scripts/test-deployment.sh check
# or  
npm run test:deployment:check

# Cleanup test data only
./scripts/test-deployment.sh cleanup
# or
npm run test:deployment:cleanup
```

### 2. `test-localstack.sh` - LocalStack Testing
Tests the LocalStack deployment for local development validation.

**Features:**
- ✅ Verifies LocalStack is running
- ✅ Tests API Gateway in LocalStack
- ✅ Validates DynamoDB operations
- ✅ Local data persistence verification

**Usage:**
```bash
# Run LocalStack tests
./scripts/test-localstack.sh test
# or
npm run test:localstack

# Cleanup LocalStack test data
./scripts/test-localstack.sh cleanup
# or
npm run test:localstack:cleanup
```

### 3. `test-all.sh` - Comprehensive Test Runner
Orchestrates all tests with performance and load testing.

**Features:**
- ✅ Pre-deployment validation
- ✅ AWS and LocalStack testing
- ✅ Performance measurement
- ✅ Load testing (10 concurrent requests)
- ✅ Data consistency verification
- ✅ Comprehensive test reporting

**Usage:**
```bash
# Run all tests
./scripts/test-all.sh all
# or
npm run test:all

# AWS tests only
./scripts/test-all.sh aws
# or
npm run test:all:aws

# LocalStack tests only
./scripts/test-all.sh localstack
# or
npm run test:all:localstack

# Performance tests only
./scripts/test-all.sh performance
# or
npm run test:all:performance
```

## Test Process Flow

### AWS Deployment Test Process:
1. **Pre-checks**: Verify AWS CLI, dependencies, stack status
2. **Get API URL**: Extract from CloudFormation outputs
3. **Cleanup**: Remove any existing test users
4. **Create User**: POST to `/users` endpoint
5. **Retrieve User**: GET from `/users/{id}` endpoint  
6. **Verify Persistence**: Check DynamoDB directly
7. **Error Testing**: Test non-existent user handling
8. **Cleanup**: Remove test data

### LocalStack Test Process:
1. **Check LocalStack**: Verify service is running
2. **Get API URL**: Extract from LocalStack API Gateway
3. **Create User**: Test via LocalStack endpoints
4. **Retrieve User**: Validate LocalStack responses
5. **Verify Persistence**: Check LocalStack DynamoDB
6. **Cleanup**: Remove test data

### Performance Testing:
- **Response Time**: Measures average API response time
- **Load Testing**: 10 concurrent requests
- **Data Consistency**: Read-after-write validation

## Test Data

Each test run creates unique test users to avoid conflicts:
- **User ID**: `test-user-{environment}-{timestamp}`
- **User Name**: `Test User {Environment}`

Test data is automatically cleaned up after each test run.

## Requirements

### Dependencies:
- `aws` CLI configured with appropriate credentials
- `curl` for HTTP requests
- `jq` for JSON parsing (recommended but optional)
- `bash` shell environment

### AWS Permissions Required:
- CloudFormation read access
- API Gateway invoke permissions
- DynamoDB read/write access to `users-table`

### LocalStack Requirements:
- LocalStack running on `http://localhost:4566`
- LocalStack DynamoDB and API Gateway services

## Example Test Output

```bash
[INFO] Starting AWS Serverless API Deployment Test
[INFO] Test User ID: test-user-deployment-1708901234
[INFO] ==========================================
[INFO] Checking dependencies...
[SUCCESS] Dependencies check passed
[INFO] Checking CloudFormation stack status...
[SUCCESS] Stack UserApiStack is in good state: UPDATE_COMPLETE
[INFO] Getting API Gateway URL from CloudFormation stack...
[SUCCESS] API URL: https://yz7ny3fa5b.execute-api.us-west-2.amazonaws.com/prod
[INFO] Checking if test user exists in DynamoDB...
[INFO] No existing test user found
[INFO] Creating test user via API...
[SUCCESS] User created successfully
[INFO] Response: {"id":"test-user-deployment-1708901234","name":"Test User Deployment","createdAt":"2025-07-26T01:15:30.123Z","updatedAt":"2025-07-26T01:15:30.123Z"}
[INFO] Retrieving test user via API...
[SUCCESS] User retrieved successfully
[INFO] Verifying user persistence in DynamoDB...
[SUCCESS] DynamoDB persistence verification passed
[INFO] Testing error handling with non-existent user...
[SUCCESS] Error handling test passed (HTTP 500)
[INFO] Cleaning up test data...
[SUCCESS] Test cleanup completed
[SUCCESS] ==========================================
[SUCCESS] All deployment tests passed successfully!
[SUCCESS] API is working correctly with DynamoDB persistence
```

## Troubleshooting

### Common Issues:

1. **AWS CLI not configured**
   ```bash
   aws configure
   ```

2. **Stack not found**
   - Ensure the stack is deployed: `npm run deploy:aws`
   - Check stack name in `test-config.sh`

3. **LocalStack not running**
   ```bash
   npm run deploy:localstack
   ```

4. **Permission denied on scripts**
   ```bash
   chmod +x scripts/*.sh
   ```

5. **jq not installed** (optional but recommended)
   ```bash
   # macOS
   brew install jq
   
   # Ubuntu/Debian
   sudo apt-get install jq
   ```

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Test AWS Deployment
  run: npm run test:deployment
  
- name: Performance Test
  run: npm run test:all:performance
```

## Configuration

Test configuration is managed in `test-config.sh` and includes:
- Stack and table names
- LocalStack URLs
- Test timeouts
- Performance test parameters

## Security Notes

- Test users are created with predictable IDs for easy cleanup
- All test data is automatically removed after tests
- No sensitive data is used in test operations
- Tests use temporary, disposable test users only
