#!/usr/bin/env bash
# Deployment Testing Configuration

# AWS Configuration
AWS_STACK_NAME="UserApiStack"
AWS_TABLE_NAME="users-table"
AWS_REGION="us-west-2"

# LocalStack Configuration
LOCALSTACK_URL="http://localhost:4566"
LOCALSTACK_REGION="us-west-2"

# Test Configuration
TEST_USER_PREFIX="test-user"
TEST_TIMEOUT_SECONDS=30
PERFORMANCE_TEST_REQUESTS=5
LOAD_TEST_CONCURRENT_REQUESTS=10

# Test Data
TEST_USER_NAME="Test User Deployment"

# Colors (for script output)
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export NC='\033[0m'

# Environment Detection
if [ -n "$LOCALSTACK_URL" ] && curl -s "$LOCALSTACK_URL/health" > /dev/null 2>&1; then
    export LOCALSTACK_AVAILABLE=true
else
    export LOCALSTACK_AVAILABLE=false
fi

# AWS CLI availability
if command -v aws &> /dev/null; then
    export AWS_CLI_AVAILABLE=true
else
    export AWS_CLI_AVAILABLE=false
fi

# jq availability (for JSON parsing)
if command -v jq &> /dev/null; then
    export JQ_AVAILABLE=true
else
    export JQ_AVAILABLE=false
fi
