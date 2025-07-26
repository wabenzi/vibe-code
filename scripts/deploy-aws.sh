#!/bin/bash

# AWS Deployment Script - Complete infrastructure deployment and teardown for AWS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[AWS]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Set AWS environment (clear LocalStack variables)
set_aws_env() {
    log_info "Setting AWS environment..."
    unset AWS_ENDPOINT_URL
    unset AWS_S3_FORCE_PATH_STYLE
    unset AWS_S3_ADDRESSING_STYLE
    export AWS_PAGER=""
    
    # Verify AWS credentials
    if ! aws sts get-caller-identity --no-cli-pager >/dev/null 2>&1; then
        log_error "AWS credentials not configured or invalid"
        log_error "Please run 'aws configure' to set up your AWS credentials"
        exit 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text --no-cli-pager)
    local region=$(aws configure get region)
    log_success "AWS environment configured (Account: $account_id, Region: ${region:-us-west-2})"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check CDK
    if ! command -v cdk &> /dev/null; then
        log_error "AWS CDK is not installed. Run: npm install -g aws-cdk"
        exit 1
    fi
    
    # Check Node.js and npm
    if ! command -v npm &> /dev/null; then
        log_error "Node.js/npm is not installed"
        exit 1
    fi
    
    log_success "All prerequisites are available"
}

# Bootstrap CDK (if needed)
bootstrap_cdk() {
    log_info "Checking CDK bootstrap status..."
    cd "$PROJECT_DIR"
    
    local account_id=$(aws sts get-caller-identity --query Account --output text --no-cli-pager)
    local region=$(aws configure get region || echo "us-west-2")
    
    # Check if already bootstrapped
    if aws cloudformation describe-stacks --stack-name CDKToolkit --region $region --no-cli-pager >/dev/null 2>&1; then
        log_success "CDK already bootstrapped for account $account_id in region $region"
    else
        log_info "Bootstrapping CDK for account $account_id in region $region..."
        npm run bootstrap
        log_success "CDK bootstrap completed"
    fi
}

# Build the project
build_project() {
    log_info "Building project..."
    cd "$PROJECT_DIR"
    npm run build
    log_success "Project built successfully"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure to AWS..."
    cd "$PROJECT_DIR"
    
    # Optional: Set DSQL cluster ARN if available
    if [ -n "$DSQL_CLUSTER_ARN" ]; then
        log_info "Using DSQL cluster: $DSQL_CLUSTER_ARN"
    else
        log_warning "No DSQL cluster ARN provided. Application will use mock data fallback."
        log_info "To use DSQL, set: export DSQL_CLUSTER_ARN=arn:aws:dsql:region:account:cluster/cluster-id"
    fi
    
    npm run deploy
    log_success "Infrastructure deployed successfully"
}

# Destroy infrastructure
destroy_infrastructure() {
    log_info "Destroying AWS infrastructure..."
    cd "$PROJECT_DIR"
    npm run destroy
    log_success "Infrastructure destroyed successfully"
}

# Show deployment information
show_deployment_info() {
    log_success "AWS deployment completed!"
    echo ""
    echo "🔗 Check AWS Console for:"
    echo "  • Lambda Functions: CreateUser, GetUser"
    echo "  • API Gateway: REST API with /users endpoints"
    echo "  • CloudWatch: Logs and monitoring dashboard"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Test the API endpoints (check deployment output for API Gateway URL)"
    echo "  2. Monitor via CloudWatch dashboard: 'UserAPI-Monitoring'"
    echo "  3. Check logs: aws logs tail /aws/lambda/user-api --follow --no-cli-pager"
    echo ""
    echo "💰 Cost management:"
    echo "  • Monitor usage in AWS Cost Explorer"
    echo "  • Consider setting up billing alerts"
    echo ""
    echo "🛑 To teardown:"
    echo "  ./scripts/deploy-aws.sh teardown"
}

# Show stack info
show_stack_info() {
    log_info "Fetching stack information..."
    cd "$PROJECT_DIR"
    
    if aws cloudformation describe-stacks --stack-name UserApiStack --no-cli-pager >/dev/null 2>&1; then
        echo ""
        echo "📊 Stack Status:"
        aws cloudformation describe-stacks --stack-name UserApiStack --query 'Stacks[0].StackStatus' --output text --no-cli-pager
        
        echo ""
        echo "🔗 Stack Outputs:"
        aws cloudformation describe-stacks --stack-name UserApiStack --query 'Stacks[0].Outputs' --output table --no-cli-pager
        
        echo ""
        echo "💸 Estimated Monthly Cost:"
        log_info "Use AWS Cost Calculator or Cost Explorer for detailed cost analysis"
    else
        log_warning "UserApiStack not found or not accessible"
    fi
}

# Main script logic
case "${1:-deploy}" in
    "deploy")
        log_info "Starting AWS deployment..."
        check_prerequisites
        set_aws_env
        build_project
        bootstrap_cdk
        deploy_infrastructure
        show_deployment_info
        ;;
    "teardown")
        log_info "Starting AWS teardown..."
        check_prerequisites
        set_aws_env
        destroy_infrastructure
        log_success "AWS teardown completed!"
        log_warning "Note: CDK bootstrap resources are retained for future deployments"
        ;;
    "redeploy")
        log_info "Redeploying to AWS..."
        check_prerequisites
        set_aws_env
        build_project
        deploy_infrastructure
        show_deployment_info
        ;;
    "status")
        log_info "Checking AWS deployment status..."
        check_prerequisites
        set_aws_env
        show_stack_info
        ;;
    "diff")
        log_info "Showing deployment diff..."
        check_prerequisites
        set_aws_env
        build_project
        cd "$PROJECT_DIR"
        npm run diff
        ;;
    *)
        echo "Usage: $0 {deploy|teardown|redeploy|status|diff}"
        echo ""
        echo "Commands:"
        echo "  deploy    - Deploy complete infrastructure to AWS"
        echo "  teardown  - Destroy infrastructure (keeps CDK bootstrap)"
        echo "  redeploy  - Build and redeploy without bootstrap"
        echo "  status    - Show stack status and outputs"
        echo "  diff      - Show changes that would be deployed"
        echo ""
        echo "Environment Variables:"
        echo "  DSQL_CLUSTER_ARN - ARN of DSQL cluster for persistence"
        echo ""
        echo "Examples:"
        echo "  $0 deploy                                    # Full deployment"
        echo "  $0 teardown                                  # Complete cleanup"
        echo "  $0 status                                    # Check deployment"
        echo "  DSQL_CLUSTER_ARN=arn:aws:... $0 deploy     # Deploy with DSQL"
        exit 1
        ;;
esac
