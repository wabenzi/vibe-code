# Script Logging Standardization

## Summary of Changes Made

The `deploy-and-export.sh` script has been updated to use the common logging library instead of defining its own color codes and echo statements.

## Before vs After

### Before (Custom Logging):
```bash
# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AWS Serverless User API - Deploy and Export${NC}"
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo -e "${RED}❌ Deployment failed!${NC}"
```

### After (Common Logging Library):
```bash
# Set custom log prefix and source common logging library
export LOG_PREFIX="DEPLOY"
source "$(dirname "$0")/common-logging.sh"

log_header "AWS Serverless User API - Deploy and Export"
log_success "✅ Deployment successful!"
log_error "❌ Deployment failed!"
```

## Benefits

1. **Consistency**: All scripts use the same logging format and colors
2. **Maintainability**: Single place to update logging behavior
3. **Readability**: Clear semantic meaning (log_error vs echo with red color)
4. **Functionality**: Built-in features like separators, headers, debug mode
5. **Customization**: LOG_PREFIX allows script-specific branding

## Example Output

The updated script now produces consistently formatted output:
```
=======================================
[SECTION] AWS Serverless User API - Deploy and Export
=======================================
[DEPLOY] Project root: /Users/leonhardt/dev/ts/aws-test
[SUCCESS] ✅ Deployment successful!
[WARNING] ⚠️  No outputs file generated, extracting from deploy output...
[DEPLOY] 📄 Reading outputs from cdk-outputs.json
[SUCCESS] ✅ Environment variables exported to: .env.deployment
=======================================
[SECTION] 📊 Deployment Summary:
[DEPLOY]   🌐 API URL: https://api.example.com
[DEPLOY]   🔑 API Key: tr5ycwc5m3
[DEPLOY]   🏠 Environment: AWS
=======================================
[SUCCESS] 🎉 Ready for testing and development!
```

## Other Scripts That Need Updates

Based on code analysis, these scripts still use custom echo-based logging:

1. **`macOS-setup.sh`** - Has custom success/warning/error functions
2. **`security-test-deployment.sh`** - Uses extensive color-coded echo statements
3. **Other scripts** - May have isolated echo statements with colors

## Recommended Next Steps

1. **Update `security-test-deployment.sh`**: This script has the most custom logging and would benefit greatly from standardization
2. **Update `macOS-setup.sh`**: Convert custom functions to use common logging
3. **Audit remaining scripts**: Search for any remaining color codes or custom logging patterns
4. **Add debug logging**: Leverage the DEBUG mode feature for troubleshooting

## Implementation Pattern

For any script that needs logging, use this pattern:

```bash
#!/bin/bash

# Set custom log prefix and source common logging library
export LOG_PREFIX="SCRIPT_NAME"
source "$(dirname "$0")/common-logging.sh"

# Your script logic here
log_header "Script Title"
log_info "Information message"
log_success "Success message"  
log_warning "Warning message"
log_error "Error message"
log_debug "Debug message" # Only shows when DEBUG=true
log_footer "Script completed"
```

## Testing

The updated `deploy-and-export.sh` script has been tested and verified to work correctly with the common logging library. All logging functions produce the expected formatted output.
