# Scripts Directory

This directory contains deployment, testing, and development scripts for the AWS Serverless User API, organized into logical subdirectories for better maintainability.

## Directory Structure

```text
scripts/
├── README.md                        # This documentation
├── CLEANUP_SUMMARY.md              # Project cleanup documentation
├── macOS-setup.sh                  # macOS development environment setup
├── deployment/                     # Deployment scripts
│   ├── deploy-aws.sh              # AWS cloud deployment
│   └── deploy-localstack.sh       # LocalStack deployment and lifecycle
├── testing/                       # Test and validation scripts
│   ├── test-all.sh               # Comprehensive test suite
│   ├── test-deployment.sh        # AWS deployment validation
│   ├── test-localstack.sh        # LocalStack API testing
│   ├── test-enterprise.sh        # Enterprise test runner
│   ├── test-integration-safe.sh   # Safe integration testing
│   ├── test-logging.sh           # Logging system tests
│   ├── security-test.sh          # Security testing
│   ├── security-test-deployment.sh # Deployment security validation
│   ├── check-localstack.sh       # LocalStack health checks
│   └── test-localstack-repository.ts # TypeScript LocalStack repository tests
├── development/                   # Development utilities
│   ├── local-dev.sh              # Local development helper
│   └── docs.sh                   # Documentation generation
├── utils/                        # Utility libraries and tools
│   ├── common-logging.sh         # Shared logging library
│   ├── validate-scripts.sh       # Script quality validation
│   └── generate-sloc-report.sh   # Source lines of code reporting
└── archive/                      # Archived/deprecated scripts (empty)
```

## Common Logging Library

All scripts use a common logging library (`utils/common-logging.sh`) for consistent output formatting and better debugging.

### Usage Example
```bash
# Source the logging library with custom prefix
LOG_PREFIX="AWS" source "${BASH_SOURCE[0]%/*}/utils/common-logging.sh"

# Use logging functions
log_info "Starting operation"
log_success "Operation completed"
log_warning "Warning message"
log_error "Error occurred"
log_section "Section Header"
log_debug "Debug information"  # Only shows when DEBUG=true

# Utility functions for structured output
log_header "Main Section Title"
log_info "Content goes here"
log_footer "Section completed successfully"
```

## Script Validation

Use `utils/validate-scripts.sh` to check all bash scripts for syntax errors and shellcheck issues

```bash
# Basic validation
./scripts/utils/validate-scripts.sh

# Verbose output showing each test
./scripts/utils/validate-scripts.sh --verbose

# Fix permissions automatically
./scripts/utils/validate-scripts.sh --fix-permissions

# Get help
./scripts/utils/validate-scripts.sh --help
```

### Validation Features
- ✅ **Syntax Check**: Validates bash syntax using `bash -n`
- ✅ **Shellcheck Analysis**: Runs shellcheck for best practices and potential issues
- ✅ **Permission Check**: Ensures scripts are executable
- ✅ **Auto-fix**: Can automatically fix permission issues
- ✅ **Comprehensive Reporting**: Detailed summary with statistics

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
./scripts/testing/test-deployment.sh test
# or
npm run test:deployment

# Health check only
./scripts/testing/test-deployment.sh check
# or  
npm run test:deployment:check

# Cleanup test data only
./scripts/testing/test-deployment.sh cleanup
# or
npm run test:deployment:cleanup
```

### 2. `test-localstack.sh` - LocalStack Testing
Tests the LocalStack deployment with DynamoDB for local development validation.

**Features:**
- ✅ Verifies LocalStack is running
- ✅ Tests API Gateway in LocalStack
- ✅ Validates DynamoDB operations (same as AWS)
- ✅ Local data persistence verification
- ✅ Consistent with AWS deployment testing

**Usage:**
```bash
# Run LocalStack tests
./scripts/testing/test-localstack.sh test
# or
npm run test:localstack

# Cleanup LocalStack test data
./scripts/testing/test-localstack.sh cleanup
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
./scripts/testing/test-all.sh all
# or
npm run test:all

# AWS tests only
./scripts/testing/test-all.sh aws
# or
npm run test:all:aws

# LocalStack tests only
./scripts/testing/test-all.sh localstack
# or
npm run test:all:localstack

# Performance tests only
./scripts/testing/test-all.sh performance
# or
npm run test:all:performance
```

## Test Process Flow

### AWS Deployment Test Process
1. **Pre-checks**: Verify AWS CLI, dependencies, stack status
2. **Get API URL**: Extract from CloudFormation outputs
3. **Cleanup**: Remove any existing test users
4. **Create User**: POST to `/users` endpoint
5. **Retrieve User**: GET from `/users/{id}` endpoint  
6. **Verify Persistence**: Check DynamoDB directly
7. **Error Testing**: Test non-existent user handling
8. **Cleanup**: Remove test data

### LocalStack Test Process
1. **Check LocalStack**: Verify service is running
2. **Get API URL**: Extract from LocalStack API Gateway
3. **Create User**: Test via LocalStack endpoints
4. **Retrieve User**: Validate LocalStack responses
5. **Verify Persistence**: Check LocalStack DynamoDB
6. **Cleanup**: Remove test data

### Performance Testing
- **Response Time**: Measures average API response time
- **Load Testing**: 10 concurrent requests
- **Data Consistency**: Read-after-write validation

## Test Data

Each test run creates unique test users to avoid conflicts
- **User ID**: `test-user-{environment}-{timestamp}`
- **User Name**: `Test User {Environment}`

Test data is automatically cleaned up after each test run.

## Requirements

### Dependencies
- `aws` CLI configured with appropriate credentials
- `curl` for HTTP requests
- `jq` for JSON parsing (recommended but optional)
- `bash` shell environment

### AWS Permissions Required
- CloudFormation read access
- API Gateway invoke permissions
- DynamoDB read/write access to `users-table`

### LocalStack Requirements
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

### Common Issues

1. **AWS CLI not configured**
   ```bash
   aws configure
   ```

2. **Stack not found**
   - Ensure the stack is deployed: `npm run deploy:aws`
   - Default stack name is "UserApiStack" (configured in each script)

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

These scripts can be integrated into CI/CD pipelines

```yaml
# Example GitHub Actions
- name: Test AWS Deployment
  run: npm run test:deployment
  
- name: Performance Test
  run: npm run test:all:performance
```

## Configuration

Each script is self-contained with its own configuration variables
- **AWS scripts**: Stack name "UserApiStack", region "us-west-2"
- **LocalStack scripts**: URL "<http://localhost:4566>"
- **Test scripts**: Auto-generated test user IDs, 30s timeouts
- **Performance**: 5 requests for basic tests, 10 concurrent for load tests

## Security Notes

- Test users are created with predictable IDs for easy cleanup
- All test data is automatically removed after tests
- No sensitive data is used in test operations
- Tests use temporary, disposable test users only

## Common Logging Library

All scripts use a unified logging system provided by `utils/common-logging.sh` for consistent output formatting and debugging.

### Features

- **Consistent Color Coding**: Different message types have distinct colors
- **Customizable Prefixes**: Scripts can set custom prefixes (AWS, LOCALSTACK, etc.)
- **Debug Support**: Optional debug logging that can be enabled with `DEBUG=true`
- **Utility Functions**: Pre-built header, footer, and separator functions

### Usage

```bash
# Source the library in your script
source "${BASH_SOURCE[0]%/*}/utils/common-logging.sh"

# Basic logging
log_info "Starting process..."
log_success "Operation completed"
log_warning "Configuration issue detected"
log_error "Failed to connect"

# Custom prefix (before sourcing)
LOG_PREFIX="AWS" source "${BASH_SOURCE[0]%/*}/utils/common-logging.sh"
log_info "This shows [AWS] prefix"

# Debug logging
DEBUG=true log_debug "Debug information"

# Structured output
log_header "Deployment Process"
log_info "Step 1: Checking dependencies"
log_success "Dependencies verified"
log_footer "Deployment completed successfully"
```

### Testing the Logging Library

Run the comprehensive test script to see all logging functions in action

```bash
./scripts/testing/test-logging.sh
```

### Color Reference

- **Blue [INFO/CUSTOM]** - General information messages
- **Green [SUCCESS]** - Successful operations
- **Yellow [WARNING]** - Warning messages
- **Red [ERROR]** - Error messages
- **Purple [SECTION]** - Section headers
- **Cyan [DEBUG]** - Debug information (only when DEBUG=true)

### Best Practices

1. **Always source utils/common-logging.sh** in new scripts for consistent output
2. **Use appropriate log levels** (info, success, warning, error)
3. **Set custom prefixes** for script-specific identification
4. **Use structured output** with headers and footers for long operations
5. **Enable debug logging** during development with `DEBUG=true`
