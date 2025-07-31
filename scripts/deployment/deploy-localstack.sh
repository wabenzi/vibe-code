#!/bin/bash

# LocalStack Deployment Script - Complete infrastructure deployment and teardown for LocalStack

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "${SCRIPT_DIR}")")"

# Source common logging functions
# shellcheck disable=SC2034
LOG_PREFIX="LOCALSTACK"
# shellcheck disable=SC1091
source "$(dirname "$(dirname "$0")")/common-logging.sh"

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
    
    # Source environment variables from .env.local if it exists
    if [[ -f "${PROJECT_DIR}/.env.local" ]]; then
        log_info "Loading environment from .env.local..."
        set -a  # automatically export all variables
        # shellcheck disable=SC1091
        source "${PROJECT_DIR}/.env.local"
        set +a  # disable automatic export
        log_success "Environment variables loaded from .env.local"
    else
        log_warning ".env.local not found, using default values..."
        # Fallback to hardcoded values if .env.local doesn't exist
        export AWS_ACCESS_KEY_ID=test
        export AWS_SECRET_ACCESS_KEY=test
        export AWS_DEFAULT_REGION=us-west-2
        export CDK_DEFAULT_ACCOUNT=000000000000
        export CDK_DEFAULT_REGION=us-west-2
    fi
    
    # Always set these LocalStack-specific variables
    export AWS_S3_FORCE_PATH_STYLE=true
    export AWS_S3_ADDRESSING_STYLE=path
    export AWS_PAGER=""
    
    # Debug: Show key environment variables if DEBUG is enabled
    if [[ "${DEBUG:-false}" = "true" ]] || [ "${LOG_LEVEL}" = "DEBUG" ]; then
        log_debug "Environment configuration:"
        log_debug "  AWS_DEFAULT_REGION: ${AWS_DEFAULT_REGION}"
        log_debug "  CDK_DEFAULT_REGION: ${CDK_DEFAULT_REGION}"
        log_debug "  CDK_DEFAULT_ACCOUNT: ${CDK_DEFAULT_ACCOUNT}"
        log_debug "  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}"
        log_debug "  DYNAMODB_ENDPOINT: ${DYNAMODB_ENDPOINT:-http://localhost:4566}"
        log_debug "  DYNAMODB_REGION: ${DYNAMODB_REGION:-us-west-2}"
    fi
    
    log_success "LocalStack environment configured"
}

# Start LocalStack services
start_services() {
    log_info "Starting LocalStack services..."
    cd "${PROJECT_DIR}"
    docker compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Check LocalStack health
    local attempts=0
    local max_attempts=30
    while [[ ${attempts} -lt ${max_attempts} ]]; do
        if curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
            log_success "LocalStack is ready"
            break
        fi
        attempts=$((attempts + 1))
        echo -n "."
        sleep 2
    done
    
    if [[ ${attempts} -eq ${max_attempts} ]]; then
        log_error "LocalStack failed to start"
        exit 1
    fi
}

# Bootstrap CDK for LocalStack
bootstrap_cdk() {
    log_info "Bootstrapping CDK for LocalStack..."
    cd "${PROJECT_DIR}"
    npm run build
    npm run local:bootstrap
    log_success "CDK bootstrap completed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure to LocalStack..."
    cd "${PROJECT_DIR}"
    npm run local:deploy
    log_success "Infrastructure deployed successfully"
}

# Stop and remove services
teardown_services() {
    log_info "Stopping and removing LocalStack services..."
    cd "${PROJECT_DIR}"
    
    # Stop and remove containers defined in docker-compose
    docker compose down -v
    
    # Clean up any orphaned LocalStack containers
    log_info "Cleaning up any orphaned LocalStack containers..."
    local orphaned_containers
    orphaned_containers=$(docker ps -aq --filter "name=localstack" 2>/dev/null || true)
    
    if [[ -n "${orphaned_containers}" ]]; then
        log_warning "Found orphaned LocalStack containers, removing them..."
        # shellcheck disable=SC2086
        docker rm -f ${orphaned_containers} 2>/dev/null || true
    fi
    
    # Clean up orphaned networks
    local orphaned_networks
    orphaned_networks=$(docker network ls --filter "name=localstack" --format "{{.Name}}" 2>/dev/null | grep -v "^localstack-network$" || true)
    
    if [[ -n "${orphaned_networks}" ]]; then
        log_warning "Found orphaned LocalStack networks, removing them..."
        echo "${orphaned_networks}" | xargs -r docker network rm 2>/dev/null || true
    fi
    
    log_success "Services stopped and cleanup completed"
}

# Show deployment information
show_info() {
    log_success "LocalStack deployment completed!"
    echo ""
    echo "🔗 Available services:"
    echo "  LocalStack: http://localhost:4566"
    echo "  DynamoDB: Available through LocalStack endpoint"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Test the API endpoints (check deployment output for API Gateway URL)"
    echo "  2. Run integration tests: npm run test:localstack"
    echo "  3. Check logs: docker logs localstack-main"
    echo ""
    echo "🛑 To teardown:"
    echo "  ./scripts/deploy-localstack.sh teardown"
}

# Main script logic
# Load environment variables for all commands
set_localstack_env

case "${1:-deploy}" in
    "deploy")
        log_info "Starting LocalStack deployment..."
        check_docker
        start_services
        bootstrap_cdk
        deploy_infrastructure
        show_info
        ;;
    "teardown")
        log_info "Starting LocalStack teardown..."
        
        # Try to destroy CDK stack first
        log_info "Destroying CDK infrastructure..."
        cd "${PROJECT_DIR}"
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
        docker ps --filter "name=localstack" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        if curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
            log_success "LocalStack is running"
        else
            log_error "LocalStack is not accessible"
        fi
        
        # Check for orphaned containers
        orphaned_containers=$(docker ps -aq --filter "name=localstack" 2>/dev/null | wc -l)
        running_containers=$(docker ps -q --filter "name=localstack" 2>/dev/null | wc -l)
        
        if [[ ${orphaned_containers} -gt ${running_containers} ]]; then
            log_warning "Found $((orphaned_containers - running_containers)) orphaned LocalStack container(s)"
            echo "Run '$0 cleanup' to remove orphaned containers"
        fi
        ;;
    "cleanup")
        log_info "Cleaning up orphaned LocalStack containers and networks..."
        
        # Remove all LocalStack containers (running and stopped)
        all_containers=$(docker ps -aq --filter "name=localstack" 2>/dev/null || true)
        
        if [[ -n "${all_containers}" ]]; then
            log_info "Removing LocalStack containers..."
            # shellcheck disable=SC2086
            docker rm -f ${all_containers} 2>/dev/null || true
            log_success "LocalStack containers removed"
        else
            log_info "No LocalStack containers found"
        fi
        
        # Remove orphaned networks
        localstack_networks=$(docker network ls --filter "name=localstack" --format "{{.Name}}" 2>/dev/null || true)
        
        if [[ -n "${localstack_networks}" ]]; then
            log_info "Removing LocalStack networks..."
            echo "${localstack_networks}" | xargs -r docker network rm 2>/dev/null || true
            log_success "LocalStack networks removed"
        else
            log_info "No LocalStack networks found"
        fi
        
        # Clean up unused volumes
        log_info "Cleaning up unused Docker volumes..."
        docker volume prune -f >/dev/null 2>&1 || true
        
        log_success "Cleanup completed!"
        ;;
    *)
        echo "Usage: $0 {deploy|teardown|restart|status|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Deploy complete infrastructure to LocalStack"
        echo "  teardown - Destroy infrastructure and stop services"
        echo "  restart  - Teardown and redeploy everything"
        echo "  status   - Check service status and detect orphaned containers"
        echo "  cleanup  - Remove all LocalStack containers, networks, and volumes"
        echo ""
        echo "Examples:"
        echo "  $0 deploy    # Full deployment"
        echo "  $0 teardown  # Complete cleanup"
        echo "  $0 status    # Check if services are running"
        echo "  $0 cleanup   # Remove orphaned containers and networks"
        exit 1
        ;;
esac
