#!/bin/bash

# LocalStack Deployment Script - Complete infrastructure deployment and teardown for LocalStack

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
    echo -e "${BLUE}[LOCALSTACK]${NC} $1"
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

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Set LocalStack environment
set_localstack_env() {
    log_info "Setting LocalStack environment variables..."
    export AWS_ENDPOINT_URL=http://localhost:4566
    export AWS_ACCESS_KEY_ID=test
    export AWS_SECRET_ACCESS_KEY=test
    export AWS_DEFAULT_REGION=us-west-2
    export CDK_DEFAULT_ACCOUNT=000000000000
    export CDK_DEFAULT_REGION=us-west-2
    export AWS_S3_FORCE_PATH_STYLE=true
    export AWS_S3_ADDRESSING_STYLE=path
    export AWS_PAGER=""
    log_success "LocalStack environment configured"
}

# Start LocalStack services
start_services() {
    log_info "Starting LocalStack and PostgreSQL services..."
    cd "$PROJECT_DIR"
    docker-compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Check LocalStack health
    local attempts=0
    local max_attempts=30
    while [ $attempts -lt $max_attempts ]; do
        if curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
            log_success "LocalStack is ready"
            break
        fi
        attempts=$((attempts + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempts -eq $max_attempts ]; then
        log_error "LocalStack failed to start"
        exit 1
    fi
    
    # Check PostgreSQL
    attempts=0
    while [ $attempts -lt $max_attempts ]; do
        if docker exec aws-test-postgres-1 pg_isready -U testuser >/dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            break
        fi
        attempts=$((attempts + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempts -eq $max_attempts ]; then
        log_error "PostgreSQL failed to start"
        exit 1
    fi
}

# Bootstrap CDK for LocalStack
bootstrap_cdk() {
    log_info "Bootstrapping CDK for LocalStack..."
    cd "$PROJECT_DIR"
    npm run build
    npm run local:bootstrap
    log_success "CDK bootstrap completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure to LocalStack..."
    cd "$PROJECT_DIR"
    npm run local:deploy
    log_success "Infrastructure deployed successfully"
}

# Stop and remove services
teardown_services() {
    log_info "Stopping and removing LocalStack services..."
    cd "$PROJECT_DIR"
    docker-compose down -v
    log_success "Services stopped and volumes removed"
}

# Show deployment information
show_info() {
    log_success "LocalStack deployment completed!"
    echo ""
    echo "🔗 Available services:"
    echo "  LocalStack: http://localhost:4566"
    echo "  PostgreSQL: localhost:5432 (testuser/testpass)"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Test the API endpoints (check deployment output for API Gateway URL)"
    echo "  2. Run integration tests: npm run test:integration"
    echo "  3. Check logs: docker logs localstack-main"
    echo ""
    echo "🛑 To teardown:"
    echo "  ./scripts/deploy-localstack.sh teardown"
}

# Main script logic
case "${1:-deploy}" in
    "deploy")
        log_info "Starting LocalStack deployment..."
        check_docker
        set_localstack_env
        start_services
        bootstrap_cdk
        deploy_infrastructure
        show_info
        ;;
    "teardown")
        log_info "Starting LocalStack teardown..."
        set_localstack_env
        
        # Try to destroy CDK stack first
        log_info "Destroying CDK infrastructure..."
        cd "$PROJECT_DIR"
        npm run local:destroy || log_warning "CDK destroy failed or stack doesn't exist"
        
        teardown_services
        log_success "LocalStack teardown completed!"
        ;;
    "restart")
        log_info "Restarting LocalStack deployment..."
        "$0" teardown
        sleep 5
        "$0" deploy
        ;;
    "status")
        log_info "Checking LocalStack services status..."
        echo ""
        echo "Docker containers:"
        docker ps --filter "name=localstack\|postgres" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        if curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
            log_success "LocalStack is running"
        else
            log_error "LocalStack is not accessible"
        fi
        ;;
    *)
        echo "Usage: $0 {deploy|teardown|restart|status}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy complete infrastructure to LocalStack"
        echo "  teardown - Destroy infrastructure and stop services"
        echo "  restart  - Teardown and redeploy everything"
        echo "  status   - Check service status"
        echo ""
        echo "Examples:"
        echo "  $0 deploy    # Full deployment"
        echo "  $0 teardown  # Complete cleanup"
        echo "  $0 status    # Check if services are running"
        exit 1
        ;;
esac
