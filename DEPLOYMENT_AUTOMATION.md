# Automated Deployment and Testing

This project now includes comprehensive automation for deployment and API testing that reuses existing integration tests.

## 🚀 Quick Start

### Deploy to Production with Testing
```bash
npm run deploy:prod:test    # Deploy to production and run API tests
npm run deploy:staging:test # Deploy to staging and run API tests
```

### Deploy without Testing
```bash
npm run deploy:prod         # Deploy to production only
npm run deploy:staging      # Deploy to staging only
```

### Test Existing Deployment
```bash
npm run test:api:manual                              # Auto-detect API URL from CDK outputs
./scripts/test-api.sh https://your-api-url.com/prod # Test specific URL
```

## 📋 Available Scripts

### Deployment Scripts
- `npm run deploy:prod` - Deploy to production environment
- `npm run deploy:prod:test` - Deploy to production and run API tests
- `npm run deploy:staging` - Deploy to staging environment  
- `npm run deploy:staging:test` - Deploy to staging and run API tests

### Testing Scripts
- `npm run test:api:prod` - Run production API test suite
- `npm run test:api:manual` - Test against deployed API (auto-detect URL)
- `npm run test:ci` - Run all unit tests with coverage
- `npm run test:integration` - Run LocalStack integration tests

### Utility Scripts
- `npm run token:generate` - Generate JWT test token
- `./scripts/deploy.sh --help` - Show deployment options
- `./scripts/test-api.sh [URL]` - Test specific API endpoint

## 🏗️ Architecture

### Deployment Automation
The deployment script (`scripts/deploy.sh`) provides:

- **Environment Support**: Production vs Staging
- **Pre-deployment Testing**: Runs CI tests before deployment
- **Post-deployment Verification**: Optional API testing
- **Error Handling**: Fails fast on test/deployment failures
- **CDK Output Parsing**: Automatically extracts API URLs

### API Testing Framework
Built on existing integration tests with enhancements:

- **JWT Authentication**: Automatically generates and uses JWT tokens
- **Production-Ready**: Shorter timeouts, real AWS endpoints
- **Comprehensive Coverage**: CRUD operations, error handling, performance
- **Clean Setup/Teardown**: Automatic test user cleanup
- **Flexible URL Detection**: Works with CDK outputs or manual URLs

### Reused Components
This automation leverages existing test infrastructure:

- **ApiClient**: Reuses `test/utils/api-client.ts` with retry logic
- **Test Utilities**: Extends `createTestUser()` and validation helpers
- **Error Handling**: Builds on existing error response patterns
- **Integration Patterns**: Adapts LocalStack tests for AWS production

## 🔧 Configuration

### Environment Variables
```bash
# Required for production
JWT_SECRET=your-jwt-secret-key
API_KEY=your-api-key

# Optional - auto-detected from CDK outputs
API_BASE_URL=https://your-api.execute-api.region.amazonaws.com/stage/
```

### Script Options
```bash
# Deployment script options
./scripts/deploy.sh --help

Usage: ./scripts/deploy.sh [OPTIONS]
Options:
  --test          Run API tests after deployment
  --skip-tests    Skip pre-deployment tests
  --env ENV       Set environment (production|staging)
  --help          Show this help message
```

### JWT Token Generation
```bash
# Basic token
npm run token:generate

# Custom user and expiration
node generate-test-token.js "custom-user-id" "24h" --export
```

## 🧪 Test Suites

### Production API Tests (`test/api/production-api.test.ts`)
- **Authentication Flow**: JWT validation, unauthorized access
- **CRUD Operations**: Create, read, delete users with proper cleanup
- **Error Handling**: 404, 400, validation errors
- **Performance**: Response time validation
- **Health Checks**: API availability verification

### Integration with Existing Tests
- **Extends**: `test/integration/user-api.test.ts` patterns
- **Reuses**: ApiClient, retry logic, test data generation
- **Adapts**: LocalStack tests for AWS production endpoints
- **Enhances**: Adds JWT authentication and production timeouts

## 📊 Example Usage

### Full Production Deployment with Verification
```bash
# Deploy and test in one command
npm run deploy:prod:test

# Output:
# 🚀 Starting AWS Deployment
# Environment: production
# Run API Tests: true
# ================================
# 🧪 Running pre-deployment tests...
# ✅ Pre-deployment tests passed
# 🏗️ Starting CDK deployment...
# ✅ Deployment completed successfully
# 📡 API URL: https://abc123.execute-api.us-west-2.amazonaws.com/prod/
# 🧪 Running API integration tests...
# ✅ API tests passed! Deployment verified.
```

### Manual API Testing
```bash
# Test current deployment
./scripts/test-api.sh

# Test specific URL
./scripts/test-api.sh https://your-api.amazonaws.com/prod

# Output:
# 🏥 Checking API health...
# ✅ API health check passed
# 🚀 Running production API test suite...
# ✅ 8 tests passed
# 🎉 All API tests passed!
```

## 🔍 Troubleshooting

### Common Issues

1. **CDK Output Not Found**
   ```bash
   # Manually specify API URL
   export API_BASE_URL="https://your-api.amazonaws.com/prod"
   npm run test:api:prod
   ```

2. **JWT Authentication Failures**
   ```bash
   # Check JWT secret matches deployment
   export JWT_SECRET="your-production-secret"
   npm run token:generate
   ```

3. **LocalStack Confusion**
   ```bash
   # Force production URL
   ./scripts/test-api.sh "https://your-aws-api.com/prod"
   ```

### Debug Commands
```bash
# Check deployment outputs
cat cdk-outputs.json | jq .

# Generate debug token
node generate-test-token.js "debug-user" "1h" --export

# Test health endpoint directly
curl https://your-api.amazonaws.com/prod/health
```

## 📈 Benefits

### For Development
- **Fast Feedback**: Immediate API verification after deployment
- **Automated Cleanup**: No manual test user management
- **Consistent Testing**: Same patterns for LocalStack and AWS

### For CI/CD
- **Pipeline Ready**: Scripts designed for automation
- **Exit Codes**: Proper error handling for build systems
- **Flexible Configuration**: Environment-specific settings

### For Production
- **Validation**: Real API testing against live endpoints
- **Performance Monitoring**: Response time assertions
- **Security Verification**: JWT authentication flow testing

The automation maintains the robustness of existing integration tests while adding production-specific enhancements for real AWS deployment verification.
