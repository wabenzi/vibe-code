# Environment Configuration

This document describes the environment variables used by the User Management API.

## Environment Variables

### Required Variables

#### `API_KEY`
- **Description**: Secure API key for authenticating requests to the User Management API
- **Required**: Yes
- **Default**: `change-this-in-production`
- **Example**: `API_KEY=your-secure-random-api-key-here`
- **Security**: This should be a cryptographically secure random string in production

#### `PROD_ALLOWED_ORIGINS`
- **Description**: Comma-separated list of allowed CORS origins for production
- **Required**: No (defaults to `https://yourdomain.com`)
- **Example**: `PROD_ALLOWED_ORIGINS=https://myapp.com,https://api.myapp.com`
- **Security**: Restrict to only your actual domains to prevent CORS attacks

## File Structure

### Local Development (`.env.local`)
```bash
# LocalStack test environment
API_KEY=tr5ycwc5m3
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
# ... other LocalStack config
```

### Production (`.env`)
```bash
# Production environment (KEEP SECURE - not committed to git)
API_KEY=your-secure-production-api-key
PROD_ALLOWED_ORIGINS=https://yourdomain.com
```

### Example Template (`.env.example`)
```bash
# Copy this to .env and update with your actual values
API_KEY=your-secure-api-key-here
PROD_ALLOWED_ORIGINS=https://yourdomain.com
```

## Security Best Practices

1. **API Key Generation**: Use a cryptographically secure random string generator
   ```bash
   # Example: Generate a secure API key
   openssl rand -base64 32
   ```

2. **Environment Separation**: Never use production API keys in development

3. **File Security**: 
   - `.env` is gitignored to prevent accidental commits
   - Only `.env.local` is included (contains only test values)
   - `.env.example` provides documentation without sensitive values

4. **Deployment**: Environment variables are automatically loaded:
   - Local: `npm run local:deploy` (sources `.env.local`)
   - Production: `npm run deploy` (sources `.env`)

## Usage in CDK

The CDK stack reads environment variables and passes them to Lambda functions:

```typescript
// In user-api-stack.ts
VALID_API_KEY: process.env.API_KEY || 'change-this-in-production'
```

## Testing

Run security tests to verify configuration:
```bash
npm run test:security
# or
./scripts/security-test.sh
```

## Troubleshooting

### Issue: Authentication failing
1. Check that `API_KEY` is set in your environment file
2. Verify the security test script uses the same API key
3. Ensure environment file is properly sourced during deployment

### Issue: CORS errors
1. Verify `PROD_ALLOWED_ORIGINS` includes your domain
2. Check that origins don't include trailing slashes
3. Ensure protocol (http/https) matches your application
