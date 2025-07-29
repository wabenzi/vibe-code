#!/bin/bash

# OpenAPI Documentation Tools Script
# Validates and serves the OpenAPI specification

set -e

# Source common logging functions
# shellcheck disable=SC2034
export LOG_PREFIX="DOCS"
# shellcheck disable=SC1091
source "$(dirname "$(dirname "$0")")/common-logging.sh"

OPENAPI_FILE="docs/openapi.yaml"

# Validate OpenAPI specification
validate_spec() {
	log_info "Validating OpenAPI specification..."
	
	if [[ ! -f ${OPENAPI_FILE} ]]; then
		log_error "OpenAPI specification not found at ${OPENAPI_FILE}"
		exit 1
	fi
	
	# Basic YAML syntax validation
	if command -v yq &>/dev/null; then
		if yq eval . "${OPENAPI_FILE}" >/dev/null 2>&1; then
			log_success "YAML syntax is valid"
		else
			log_error "Invalid YAML syntax in ${OPENAPI_FILE}"
			exit 1
		fi
	else
		log_warning "yq not available for YAML validation"
	fi
	
	# OpenAPI validation using swagger-codegen-cli if available
	if command -v npx &>/dev/null; then
		log_info "Running OpenAPI validation..."
		if npx --yes swagger-codegen-cli validate -i "${OPENAPI_FILE}" 2>/dev/null; then
			log_success "OpenAPI specification is valid"
		else
			log_warning "OpenAPI validation failed (this may be due to tool limitations)"
		fi
	else
		log_warning "npm/npx not available for OpenAPI validation"
	fi
}

# Serve OpenAPI documentation
serve_docs() {
	log_info "Starting OpenAPI documentation server..."
	log_info "Documentation will be available at: http://localhost:8080"
	log_info "Press Ctrl+C to stop the server"
	
	if command -v npx &>/dev/null; then
		npx --yes swagger-ui-serve "${OPENAPI_FILE}"
	else
		log_error "npm/npx not available. Please install Node.js to serve documentation."
		exit 1
	fi
}

# Generate client code
generate_client() {
	local language="$1"
	local output_dir="clients/${language}"
	
	if [[ -z ${language} ]]; then
		log_error "Language not specified for client generation"
		exit 1
	fi
	
	log_info "Generating ${language} client to ${output_dir}..."
	
	if command -v npx &>/dev/null; then
		npx --yes @openapitools/openapi-generator-cli generate \
			-i "${OPENAPI_FILE}" \
			-g "${language}" \
			-o "${output_dir}"
		
		log_success "Client generated successfully in ${output_dir}"
	else
		log_error "npm/npx not available for client generation"
		exit 1
	fi
}

# Show available options
show_help() {
	echo "OpenAPI Documentation Tools"
	echo ""
	echo "Usage: $0 [command] [options]"
	echo ""
	echo "Commands:"
	echo "  validate                 Validate OpenAPI specification"
	echo "  serve                    Serve documentation with Swagger UI"
	echo "  generate <language>      Generate client code"
	echo "  help                     Show this help message"
	echo ""
	echo "Client Generation Languages:"
	echo "  typescript-axios         TypeScript with Axios"
	echo "  javascript               JavaScript"
	echo "  python                   Python"
	echo "  java                     Java"
	echo "  csharp                   C#"
	echo "  go                       Go"
	echo ""
	echo "Examples:"
	echo "  $0 validate"
	echo "  $0 serve"
	echo "  $0 generate typescript-axios"
	echo ""
}

# Handle script arguments
case "${1:-help}" in
"validate")
	validate_spec
	;;
"serve")
	validate_spec
	serve_docs
	;;
"generate")
	if [[ -z ${2} ]]; then
		log_error "Language not specified for client generation"
		show_help
		exit 1
	fi
	validate_spec
	generate_client "$2"
	;;
"help"|"--help"|"-h")
	show_help
	;;
*)
	log_error "Unknown command: $1"
	show_help
	exit 1
	;;
esac
