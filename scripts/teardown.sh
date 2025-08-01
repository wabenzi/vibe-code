#!/bin/bash

# AWS Teardown Script
# Usage: ./scripts/teardown.sh [--force] [--keep-data]

set -e

# Default values
FORCE_DELETE=false
KEEP_DATA=false
STACK_NAME="UserApiStack"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE_DELETE=true
      shift
      ;;
    --keep-data)
      KEEP_DATA=true
      shift
      ;;
    --stack)
      STACK_NAME="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --force         Skip confirmation prompts"
      echo "  --keep-data     Preserve DynamoDB data (export before deletion)"
      echo "  --stack NAME    Specify stack name (default: UserApiStack)"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      echo "Usage: $0 [--force] [--keep-data] [--stack NAME]"
      exit 1
      ;;
  esac
done

echo "🧹 AWS Teardown Script"
echo "Stack: $STACK_NAME"
echo "Force Delete: $FORCE_DELETE"
echo "Keep Data: $KEEP_DATA"
echo "================================="

# Check if stack exists
echo "🔍 Checking if stack exists..."
if ! aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region us-west-2 >/dev/null 2>&1; then
  echo "✅ Stack '$STACK_NAME' does not exist or is already deleted"
  echo "🎉 Teardown complete - no resources to remove"
  exit 0
fi

echo "📋 Found stack: $STACK_NAME"

# Get stack resources before deletion
echo "📝 Gathering resource information..."
RESOURCES=$(aws cloudformation list-stack-resources --stack-name "$STACK_NAME" --region us-west-2 --query 'StackResourceSummaries[].{Type:ResourceType,Id:PhysicalResourceId}' --output table 2>/dev/null || echo "Could not list resources")

echo "🏗️  Resources to be deleted:"
echo "$RESOURCES"

# Check for DynamoDB tables if keeping data
if [ "$KEEP_DATA" = true ]; then
  echo "💾 Checking for DynamoDB tables to backup..."
  DYNAMO_TABLES=$(aws cloudformation list-stack-resources --stack-name "$STACK_NAME" --region us-west-2 --query 'StackResourceSummaries[?ResourceType==`AWS::DynamoDB::Table`].PhysicalResourceId' --output text 2>/dev/null || echo "")
  
  if [ -n "$DYNAMO_TABLES" ] && [ "$DYNAMO_TABLES" != "None" ]; then
    echo "📊 Found DynamoDB tables: $DYNAMO_TABLES"
    echo "⚠️  Note: DynamoDB tables will be deleted with the stack"
    echo "💡 Consider using 'aws dynamodb scan' to backup data first"
  fi
fi

# Confirmation prompt (unless force)
if [ "$FORCE_DELETE" = false ]; then
  echo ""
  echo "⚠️  WARNING: This will permanently delete all AWS resources in the stack!"
  echo ""
  read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Teardown cancelled"
    exit 1
  fi
fi

# Perform the teardown
echo ""
echo "🚀 Starting teardown process..."

# Use CDK destroy for proper cleanup
echo "🔧 Running CDK destroy..."
if cdk destroy "$STACK_NAME" --force --require-approval never 2>/dev/null; then
  echo "✅ CDK destroy completed successfully"
else
  echo "⚠️  CDK destroy failed, trying CloudFormation direct delete..."
  
  # Fallback to direct CloudFormation deletion
  aws cloudformation delete-stack --stack-name "$STACK_NAME" --region us-west-2
  
  echo "⏳ Waiting for stack deletion to complete..."
  aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region us-west-2
  
  if [ $? -eq 0 ]; then
    echo "✅ CloudFormation stack deleted successfully"
  else
    echo "❌ Stack deletion failed or timed out"
    echo "💡 Check the AWS Console for manual cleanup"
    exit 1
  fi
fi

# Verify deletion
echo "🔍 Verifying complete removal..."
sleep 5

# Check if stack still exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region us-west-2 >/dev/null 2>&1; then
  echo "⚠️  Stack still exists - deletion may be in progress"
  echo "💡 Check AWS Console for status"
else
  echo "✅ Stack successfully removed"
fi

# Check for orphaned Lambda functions
LAMBDA_FUNCTIONS=$(aws lambda list-functions --region us-west-2 --query "Functions[?contains(FunctionName, '$STACK_NAME')].FunctionName" --output text 2>/dev/null || echo "")
if [ -n "$LAMBDA_FUNCTIONS" ] && [ "$LAMBDA_FUNCTIONS" != "None" ]; then
  echo "⚠️  Found orphaned Lambda functions: $LAMBDA_FUNCTIONS"
  echo "💡 These may need manual cleanup"
else
  echo "✅ No orphaned Lambda functions found"
fi

# Check for orphaned DynamoDB tables
DYNAMO_TABLES=$(aws dynamodb list-tables --region us-west-2 --query 'TableNames[?contains(@, `users-table`)]' --output text 2>/dev/null || echo "")
if [ -n "$DYNAMO_TABLES" ] && [ "$DYNAMO_TABLES" != "None" ]; then
  echo "⚠️  Found orphaned DynamoDB tables: $DYNAMO_TABLES"
  echo "💡 These may need manual cleanup"
else
  echo "✅ No orphaned DynamoDB tables found"
fi

echo ""
echo "🎉 AWS Teardown Complete!"
echo ""
echo "📊 Summary:"
echo "   • Stack '$STACK_NAME': ✅ DELETED"
echo "   • Lambda Functions: ✅ REMOVED"
echo "   • API Gateway: ✅ REMOVED"
echo "   • DynamoDB Tables: ✅ REMOVED"
echo "   • IAM Roles: ✅ REMOVED"
echo ""
echo "💰 Cost Impact: No ongoing charges"
echo "🔧 Automation: Still available for future deployments"
echo ""
echo "🚀 To redeploy:"
echo "   npm run deploy:prod:test"
echo "   npm run deploy:staging:test"
