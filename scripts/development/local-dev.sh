#!/bin/bash

# Local Development Helper Script for AWS Test Project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Source common logging functions
LOG_PREFIX="LOCAL-DEV"
source "$(dirname "$(dirname "$0")")/common-logging.sh"

# Deploy to LocalStack

# Start LocalStack environment
start_env() {
    log_info "Starting LocalStack development environment..."
    
    # Delegate to the comprehensive deployment script
    "${SCRIPT_DIR}/../deployment/deploy-localstack.sh" deploy
    
    # Additional development-specific information
    log_info "LocalStack Dashboard: http://localhost:4566"
    log_info "PostgreSQL: localhost:5432 (user: testuser, password: testpass)"
}

# Stop LocalStack environment
stop_env() {
    log_info "Stopping LocalStack development environment..."
    
    # Delegate to the comprehensive deployment script
    "${SCRIPT_DIR}/../deployment/deploy-localstack.sh" teardown
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
    
    # Use the comprehensive cleanup and restart functionality
    "${SCRIPT_DIR}/../deployment/deploy-localstack.sh" restart
}

# Check status of LocalStack services
status_env() {
    log_info "Checking LocalStack environment status..."
    
    # Delegate to the deployment script's status command
    "${SCRIPT_DIR}/../deployment/deploy-localstack.sh" status
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
    echo "  status             Check LocalStack service status"
    echo "  help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start           # Start the development environment"
    echo "  $0 deploy          # Deploy to LocalStack"
    echo "  $0 logs postgres   # Show PostgreSQL logs"
    echo "  $0 reset           # Clean restart everything"
    echo "  $0 status          # Check service status"
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
    "status")
        status_env
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
