#!/bin/bash

# AWS Deployment Script with Optional Testing
# Usage: ./scripts/deploy.sh [--test] [--env production|staging] [--skip-tests]

set -e

# Default values
RUN_TESTS=false
ENVIRONMENT="staging"
SKIP_TESTS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --test)
      RUN_TESTS=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --test          Run API tests after deployment"
      echo "  --skip-tests    Skip pre-deployment tests"
      echo "  --env ENV       Set environment (production|staging)"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      echo "Usage: $0 [--test] [--skip-tests] [--env production|staging]"
      exit 1
      ;;
  esac
done

echo "🚀 Starting AWS Deployment"
echo "Environment: $ENVIRONMENT"
echo "Run API Tests: $RUN_TESTS"
echo "Skip Pre-deployment Tests: $SKIP_TESTS"
echo "================================="

# Set environment variables based on deployment target
if [ "$ENVIRONMENT" = "production" ]; then
  echo "⚠️  PRODUCTION DEPLOYMENT"
  echo "Make sure you have:"
  echo "- Set JWT_SECRET environment variable"
  echo "- Set JWT_SECRET environment variable"
  echo "- Reviewed all changes"
  read -p "Continue with production deployment? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
  fi
fi

# Run tests before deployment (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
  echo "🧪 Running pre-deployment tests..."
  
  if ! npm run test:ci; then
    echo "❌ Tests failed! Deployment cancelled."
    exit 1
  fi
  echo "✅ Pre-deployment tests passed"
fi

# Deploy to AWS
echo "🏗️  Starting CDK deployment..."
npm run deploy

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  exit 1
fi

echo "✅ Deployment completed successfully"

# Extract API URL from CDK output
API_URL=""
if [ -f "cdk-outputs.json" ]; then
  API_URL=$(jq -r '.UserApiStack.ApiUrl // .UserApiStack.UserApiEndpoint22DD5314' cdk-outputs.json 2>/dev/null || echo "")
fi

if [ -z "$API_URL" ]; then
  echo "⚠️  Could not extract API URL from CDK outputs"
  echo "Checking if deployment created the outputs file..."
  if [ -f "cdk-outputs.json" ]; then
    echo "CDK outputs file exists, but API URL extraction failed"
    echo "Contents:"
    cat cdk-outputs.json | jq . 2>/dev/null || cat cdk-outputs.json
  fi
  echo "You may need to run API tests manually"
else
  echo "📡 API URL: $API_URL"
  
  # Export API URL for tests
  export API_BASE_URL="$API_URL"
  
  # Run API tests if requested
  if [ "$RUN_TESTS" = true ]; then
    echo "🧪 Running API integration tests..."
    
    # Use the existing integration tests but with production API URL
    npm run test:api:prod
    
    if [ $? -eq 0 ]; then
      echo "✅ API tests passed! Deployment verified."
    else
      echo "⚠️  API tests failed. Check deployment health."
      exit 1
    fi
  else
    echo "ℹ️  Skipping API tests. Run with --test flag or 'npm run test:api' to verify deployment."
  fi
fi

echo ""
echo "🎉 Deployment Summary:"
echo "   Environment: $ENVIRONMENT"
echo "   API URL: ${API_URL:-'Check CDK outputs'}"
echo "   Status: ✅ SUCCESS"
echo ""
echo "Next steps:"
echo "   • Test API: npm run test:api"
echo "   • View logs: npm run logs"
echo "   • Monitor: Check CloudWatch dashboard"
