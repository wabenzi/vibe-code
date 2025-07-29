#!/bin/bash

# Local Development Helper Script for AWS Test Project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source common logging functions
LOG_PREFIX="LOCAL-DEV"
source "$(dirname "$0")/common-logging.sh"

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    log_success "Docker is running"
}

# Wait for service to be ready
wait_for_service() {
    local service_name=$1
    local host=$2
    local port=$3
    local max_attempts=30
    local attempt=1

    log_info "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z "$host" "$port" 2>/dev/null; then
            log_success "$service_name is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "$service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Start LocalStack environment
start_env() {
    log_info "Starting LocalStack development environment..."
    
    check_docker
    
    cd "$PROJECT_DIR"
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    wait_for_service "LocalStack" "localhost" "4566"
    wait_for_service "PostgreSQL" "localhost" "5432"
    
    # Source environment variables
    if [ -f ".env.local" ]; then
        set -a
        source .env.local
        set +a
        log_success "Environment variables loaded"
    fi
    
    log_success "LocalStack environment is ready!"
    log_info "LocalStack Dashboard: http://localhost:4566"
    log_info "PostgreSQL: localhost:5432 (user: testuser, password: testpass)"
}

# Stop LocalStack environment
stop_env() {
    log_info "Stopping LocalStack development environment..."
    
    cd "$PROJECT_DIR"
    docker-compose down
    
    log_success "LocalStack environment stopped"
}

# Deploy to LocalStack
deploy_local() {
    log_info "Deploying to LocalStack..."
    
    cd "$PROJECT_DIR"
    
    # Source environment variables
    if [ -f ".env.local" ]; then
        set -a
        source .env.local
        set +a
        log_success "Environment variables loaded"
    else
        log_error ".env.local file not found"
        exit 1
    fi
    
    # Build the project
    log_info "Building the project..."
    npm run build
    
    # Deploy using CDK with LocalStack environment
    log_info "Deploying with CDK to LocalStack..."
    npm run local:deploy
    
    log_success "Deployment to LocalStack completed!"
}

# Run integration tests
test_integration() {
    log_info "Running integration tests..."
    
    cd "$PROJECT_DIR"
    
    # Source environment variables
    if [ -f ".env.local" ]; then
        set -a
        source .env.local
        set +a
    fi
    
    npm run test:integration
    
    log_success "Integration tests completed!"
}

# Show logs
show_logs() {
    local service=${1:-"localstack"}
    
    log_info "Showing logs for $service..."
    
    cd "$PROJECT_DIR"
    
    case $service in
        "localstack")
            docker logs -f localstack-main
            ;;
        "postgres")
            docker logs -f localstack-postgres
            ;;
        "all")
            docker-compose logs -f
            ;;
        *)
            log_error "Unknown service: $service"
            log_info "Available services: localstack, postgres, all"
            exit 1
            ;;
    esac
}

# Reset environment (clean restart)
reset_env() {
    log_warning "Resetting LocalStack environment (this will remove all data)..."
    
    cd "$PROJECT_DIR"
    
    # Stop and remove containers
    docker-compose down -v
    
    # Remove LocalStack volume if it exists
    docker volume rm aws-test_localstack_data 2>/dev/null || true
    
    # Start fresh
    start_env
    
    log_success "Environment reset completed!"
}

# Show help
show_help() {
    echo "Local Development Helper Script"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  start              Start LocalStack development environment"
    echo "  stop               Stop LocalStack development environment"
    echo "  deploy             Deploy application to LocalStack"
    echo "  test               Run integration tests"
    echo "  logs [service]     Show logs (services: localstack, postgres, all)"
    echo "  reset              Reset environment (clean restart)"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start           # Start the development environment"
    echo "  $0 deploy          # Deploy to LocalStack"
    echo "  $0 logs postgres   # Show PostgreSQL logs"
    echo "  $0 reset           # Clean restart everything"
}

# Main command handling
case "${1:-help}" in
    "start")
        start_env
        ;;
    "stop")
        stop_env
        ;;
    "deploy")
        deploy_local
        ;;
    "test")
        test_integration
        ;;
    "logs")
        show_logs "${2:-localstack}"
        ;;
    "reset")
        reset_env
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
