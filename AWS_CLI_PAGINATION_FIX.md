# AWS CLI Pagination Fix

## Problem
AWS CLI v2 was causing pagination issues in scripts even when using the `--no-paginate` flag. Commands would hang or open pager programs like `less`, breaking automation.

## Root Cause
AWS CLI v2 has **two separate types of pagination**:

1. **Server-side pagination**: Controls how many results are fetched from AWS services
   - Controlled by: `--no-paginate` flag
   - Purpose: Prevents multiple API calls to fetch all results

2. **Client-side pager**: Controls how output is displayed in the terminal  
   - Controlled by: `--no-cli-pager` flag or `AWS_PAGER` environment variable
   - Purpose: Automatically pipes output through programs like `less` for easier reading

## Solution
For scripts and automation, you need to disable **BOTH** types of pagination:

### Method 1: Use both flags
```bash
aws --no-paginate --no-cli-pager <command>
```

### Method 2: Set environment variable (permanent solution)
```bash
export AWS_PAGER=""
```

Add to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.) to make it permanent.

### Method 3: Temporary environment variable
```bash
AWS_PAGER="" aws --no-paginate <command>
```

## Files Updated

### Scripts
- `scripts/direct-deploy.sh`: All AWS CLI commands now use `--no-paginate --no-cli-pager`

### Documentation
- `DEPLOYMENT.md`: 
  - Updated AWS CLI examples to include both flags
  - Added comprehensive troubleshooting section
  - Added section on permanent pagination configuration

### Test Files
- `scripts/test-pagination.sh`: Created demonstration script showing the difference

## Verification
The fix was tested with LocalStack and confirmed to eliminate pagination issues in automated scripts.

## Key Takeaway
**Always use both pagination flags in scripts**: `--no-paginate --no-cli-pager`

This ensures AWS CLI commands work reliably in automation, CI/CD pipelines, and shell scripts.
