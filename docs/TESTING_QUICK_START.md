# Testing Quick Start Guide

**Quick reference for developers who need to run tests immediately**

> 📋 **For comprehensive testing strategy and enterprise patterns, see [TESTING.md](./TESTING.md)**

This document provides practical, step-by-step information about running tests in the AWS Serverless User API project, with focus on common issues and solutions.

## ⚠️ Critical Prerequisites for Integration Tests

**Integration tests require LocalStack to be running before test execution.** The tests **cannot be assumed to be running** and will fail with connection errors if LocalStack is not available.

### LocalStack Dependency

Integration tests connect to LocalStack on `localhost:4566` and will fail with:
```
connect ECONNREFUSED 127.0.0.1:4566
```

**This is expected behavior** - integration tests require a live LocalStack environment.

## Test Categories

### 1. Unit Tests (✅ No Dependencies)
```bash
npm run test:unit
```
- **Status**: ✅ Always pass (no external dependencies)
- **Coverage**: 260 tests covering business logic, validation, authentication
- **Duration**: ~3 seconds
- **Dependencies**: None

### 2. Integration Tests (⚠️ Requires LocalStack + Current Build)
```bash
# ❌ This will FAIL if LocalStack is not running
npm run test:integration

# ✅ Correct approach - ensure current build and start LocalStack
npm run build                   # Build current code first
npm run deploy:localstack       # Start LocalStack + deploy current build
npm run test:integration       # Then run integration tests
npm run deploy:localstack:teardown  # Clean up when done

# 🚀 Automated approach (recommended) - uses existing proven scripts
npm run test:all:localstack     # Handles build + LocalStack lifecycle automatically
npm run test:enterprise         # Alternative comprehensive test suite
```
- **Status**: ⚠️ Requires LocalStack infrastructure and current build
- **Coverage**: End-to-end API testing, real HTTP requests
- **Duration**: ~90 seconds (includes retry logic)
- **Dependencies**: LocalStack container on port 4566, current TypeScript build

### 3. Contract Tests (✅ No Dependencies)
```bash
npm run test:contract
```
- **Status**: ✅ Uses Pact mock server (no external dependencies)
- **Coverage**: Consumer-provider contract validation
- **Dependencies**: None (uses internal mock server)

### 4. Behavioral Tests (✅ No Dependencies)
```bash
npm run test:behavioral
```
- **Status**: ✅ Cucumber BDD scenarios
- **Dependencies**: None

## Complete Testing Workflows

### Local Development Testing
```bash
# 1. Quick validation (no infrastructure needed)
npm run test:unit
npm run test:contract
npm run test:behavioral

# 2. Check LocalStack status (using existing scripts)
curl -s http://localhost:4566/_localstack/health

# 3. Full local testing (requires Docker)
npm run build                   # Build current code
npm run deploy:localstack       # Start LocalStack + deploy
npm run test:integration       # Test against LocalStack
npm run deploy:localstack:teardown  # Clean up

# 4. Automated integration testing (recommended - existing proven scripts)
npm run test:all:localstack     # Handles everything automatically
npm run test:enterprise         # Alternative comprehensive suite
```

### CI/CD Pipeline Testing
```bash
# Unit tests only (for fast feedback)
npm run test:ci

# Full test suite with LocalStack management
npm run test:all:localstack     # Manages LocalStack lifecycle
```

### Production Deployment Testing
```bash
# Deploy to AWS and test
npm run deploy:aws
npm run test:deployment
```

## LocalStack Management

### Manual LocalStack Control
```bash
# Start LocalStack with infrastructure
npm run deploy:localstack

# Check LocalStack status
npm run deploy:localstack:status

# Stop and clean up
npm run deploy:localstack:teardown
```

### Automated LocalStack Management
```bash
# These scripts handle LocalStack lifecycle automatically
npm run test:all:localstack      # Start → Test → Stop
npm run test:enterprise         # Full enterprise test suite
```

## Common Test Failures and Solutions

### 1. Integration Test Connection Failures
**Error:**
```
connect ECONNREFUSED 127.0.0.1:4566
```

**Solution:**
```bash
# Check LocalStack status using existing utilities
curl -s http://localhost:4566/_localstack/health

# Start LocalStack if not running
npm run deploy:localstack
# Wait for deployment to complete, then run tests
npm run test:integration

# Or use the existing automated approach
npm run test:all:localstack     # Handles LocalStack lifecycle
npm run test:enterprise         # Alternative comprehensive approach
```

### 2. Integration Tests Using Stale Code
**Problem:**
Integration tests are running against an older build, not reflecting recent code changes.

**Solution:**
```bash
# The existing scripts already handle this correctly:
npm run test:all:localstack     # Automatically builds + deploys + tests

# Or manual approach
npm run build
npm run deploy:localstack  # This redeploys the fresh build
npm run test:integration
```

### 2. LocalStack Container Issues
**Error:**
```
LocalStack container not found or not running
```

**Solution:**
```bash
# Clean up any stale containers
docker compose down
docker system prune -f

# Restart LocalStack
npm run deploy:localstack
```

### 3. Port Conflicts
**Error:**
```
Port 4566 already in use
```

**Solution:**
```bash
# Find and stop conflicting services
lsof -ti:4566 | xargs kill -9

# Or restart Docker
docker restart $(docker ps -q)
```

## Test Environment Variables

### Required for Integration Tests
- `API_URL`: Auto-detected from LocalStack deployment
- `VALID_API_KEY`: Generated during LocalStack setup

### Optional Test Configuration
- `TEST_TIMEOUT`: Test timeout in milliseconds (default: 120000)
- `TEST_RETRIES`: Number of retry attempts (default: 3)
- `VERBOSE_TESTS`: Enable detailed test output

## Performance Expectations

| Test Category | Duration | Tests | Dependencies |
|--------------|----------|-------|--------------|
| Unit Tests | ~3s | 260 | None |
| Contract Tests | ~1s | 5 | None |
| Integration Tests | ~90s | 13 | LocalStack |
| Behavioral Tests | ~2s | Variable | None |

## Troubleshooting

### Check LocalStack Health
```bash
curl http://localhost:4566/_localstack/health
```

### View LocalStack Logs
```bash
docker compose logs localstack
```

### Reset LocalStack State
```bash
npm run deploy:localstack:teardown
npm run deploy:localstack
```

### Check API Deployment
```bash
# LocalStack
curl http://localhost:4566/_localstack/health

# AWS
aws apigateway get-rest-apis --region us-west-2
```

## Best Practices

1. **Always start LocalStack before integration tests**
2. **Use automated scripts for CI/CD** (`npm run test:all:localstack`)
3. **Run unit tests first** for fast feedback
4. **Clean up resources** after testing
5. **Check LocalStack health** before running integration tests

## Continuous Integration

### GitHub Actions Example
```yaml
- name: Run Unit Tests
  run: npm run test:unit

- name: Start LocalStack
  run: npm run deploy:localstack

- name: Run Integration Tests
  run: npm run test:integration

- name: Cleanup LocalStack
  run: npm run deploy:localstack:teardown
  if: always()
```

This ensures proper LocalStack lifecycle management in CI environments.