#!/bin/bash

# Check LocalStack Status Script
# Verifies if LocalStack is running and ready for integration tests

set -e

LOCALSTACK_URL="http://localhost:4566"
TIMEOUT=10

echo "🔍 Checking LocalStack status..."

# Function to check LocalStack health
check_localstack() {
    if curl -s --max-time $TIMEOUT "$LOCALSTACK_URL/_localstack/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if LocalStack is running
if check_localstack; then
    echo "✅ LocalStack is running and healthy"
    echo "🔗 Health endpoint: $LOCALSTACK_URL/_localstack/health"
    
    # Check if API Gateway is deployed
    if curl -s --max-time $TIMEOUT "$LOCALSTACK_URL/_localstack/health" | grep -q "apigateway.*running"; then
        echo "✅ API Gateway service is running"
    else
        echo "⚠️  API Gateway may not be fully deployed"
    fi
    
    echo ""
    echo "✅ Ready to run integration tests:"
    echo "   npm run test:integration"
    
    exit 0
else
    echo "❌ LocalStack is not running or not healthy"
    echo ""
    echo "🚀 To start LocalStack and deploy infrastructure:"
    echo "   npm run deploy:localstack"
    echo ""
    echo "📖 For more information, see docs/TESTING_QUICK_START.md"
    
    exit 1
fi
