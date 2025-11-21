# Integration Validation Suite Guide

The Integration Validation Suite is a comprehensive testing framework designed to validate all critical system integrations in the medical platform. It ensures that payment processing, database operations, real-time features, and video calling functionality are working correctly.

## Overview

The validation suite tests four main integration areas:

1. **Stripe Payment Integration** - Payment processing, webhooks, and Mexican payment methods
2. **Supabase Database Integration** - Database connectivity, RLS policies, and authentication
3. **WebSocket Real-time Features** - Chat functionality and real-time connections
4. **WebRTC Video Call Functionality** - Video calling capabilities and media device access

## Quick Start

### Running the Validation Suite

```bash
# Basic validation (recommended)
npm run validate:integrations

# Verbose output with detailed logs
npm run validate:integrations:verbose

# Save detailed report to file
npm run validate:integrations:output

# Both verbose and output
npm run validate:integrations -- --verbose --output
```

### Running Unit Tests

```bash
# Test the validation suite itself
npm run test:integration-validation

# Run all tests
npm test
```

## Prerequisites

Before running the validation suite, ensure you have:

1. **Environment Variables Configured**:

   ```env
   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...

   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...

   # Application Configuration
   NEXTAUTH_URL=http://localhost:3000
   DATABASE_URL=postgresql://...
   ```

2. **Database Setup**:

   ```bash
   # Set up database schema
   npm run db:migrate

   # Set up validation helper functions (run in Supabase SQL editor)
   # Copy and execute: scripts/setup-validation-helpers.sql
   ```

3. **Development Server Running** (for WebSocket tests):
   ```bash
   npm run dev
   ```

## Validation Components

### 1. Stripe Payment Integration

**Tests Performed:**

- ✅ Stripe API connection and account verification
- ✅ Payment intent creation and cancellation
- ✅ Webhook endpoint configuration
- ✅ Mexican payment methods (Card, OXXO, SPEI)

**Common Issues:**

- Invalid API keys → Check `STRIPE_SECRET_KEY` environment variable
- Webhook configuration missing → Verify webhook endpoints in Stripe dashboard
- Payment method restrictions → Ensure Mexican payment methods are enabled

### 2. Supabase Database Integration

**Tests Performed:**

- ✅ Database connection and query execution
- ✅ Row Level Security (RLS) policies validation
- ✅ Real-time subscriptions setup
- ✅ Authentication flow configuration

**Common Issues:**

- Database connection failed → Check `DATABASE_URL` and Supabase credentials
- RLS policies missing → Run database migrations and check policy setup
- Real-time not working → Verify Supabase real-time is enabled for your project

### 3. WebSocket Real-time Features

**Tests Performed:**

- ✅ WebSocket connection establishment
- ✅ Chat authentication flow
- ✅ Real-time message handling
- ✅ Connection error handling

**Common Issues:**

- Connection timeout → Ensure development server is running on correct port
- Authentication errors → Check JWT token configuration and user authentication
- Socket.IO path issues → Verify `/api/socketio` endpoint is accessible

### 4. WebRTC Video Call Functionality

**Tests Performed:**

- ✅ WebRTC API support detection
- ✅ Media device access and enumeration
- ✅ Peer connection creation and offer generation
- ✅ Video session database operations

**Common Issues:**

- WebRTC not supported → Check browser compatibility (Chrome, Firefox, Safari)
- Media device access denied → Grant camera/microphone permissions
- Peer connection failed → Check STUN/TURN server configuration

## Understanding Results

### Success Output

```
✅ All integration tests passed!
📄 Detailed report saved to: reports/integration-validation-2024-01-15T10-30-00-000Z.md
```

### Failure Output

```
❌ Some integration tests failed. Please review the report above.

CRITICAL FAILURES:
  - Stripe payment integration
  - WebSocket real-time features

📄 Error report saved to: reports/integration-validation-error-2024-01-15T10-30-00-000Z.md
```

### Report Structure

The validation report includes:

1. **Executive Summary** - Overall pass/fail status and critical issues
2. **Detailed Results** - Individual test results with error messages
3. **Recommendations** - Specific steps to fix failing integrations
4. **Technical Details** - Raw test data and configuration information

## Troubleshooting

### Environment Issues

1. **Missing Environment Variables**:

   ```bash
   # Check if all required variables are set
   node -e "console.log(process.env.STRIPE_SECRET_KEY ? '✅ Stripe configured' : '❌ Stripe missing')"
   node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Supabase configured' : '❌ Supabase missing')"
   ```

2. **Database Connection Issues**:

   ```bash
   # Test database connection directly
   npx prisma db pull
   ```

3. **Development Server Issues**:
   ```bash
   # Ensure server is running and accessible
   curl http://localhost:3000/api/health
   ```

### Integration-Specific Issues

#### Stripe Issues

- **Invalid API Key**: Check Stripe dashboard for correct test/live keys
- **Webhook Verification**: Ensure webhook secret matches Stripe configuration
- **Mexican Payment Methods**: Verify account is enabled for Mexico

#### Supabase Issues

- **RLS Policies**: Run `scripts/setup-validation-helpers.sql` in Supabase SQL editor
- **Real-time**: Enable real-time in Supabase project settings
- **Authentication**: Check JWT secret configuration

#### WebSocket Issues

- **Port Conflicts**: Ensure port 3000 is available and not blocked
- **CORS Issues**: Check CORS configuration in Socket.IO setup
- **Authentication**: Verify token-based authentication is working

#### WebRTC Issues

- **Browser Support**: Use Chrome, Firefox, or Safari (latest versions)
- **HTTPS Required**: WebRTC requires HTTPS in production
- **Media Permissions**: Grant camera/microphone access when prompted

## Advanced Usage

### Custom Validation

You can run individual validation components:

```typescript
import {
  StripeValidator,
  SupabaseValidator,
  WebSocketValidator,
  WebRTCValidator,
} from "../lib/integration-validation-suite";

// Test only Stripe integration
const stripeValidator = new StripeValidator();
const result = await stripeValidator.validateStripeConnection();
console.log(result);
```

### Continuous Integration

Add validation to your CI/CD pipeline:

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on: [push, pull_request]

jobs:
  validate-integrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - run: npm install
      - run: npm run validate:integrations
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          # ... other environment variables
```

### Monitoring and Alerts

Set up automated monitoring:

```bash
# Run validation every hour and alert on failures
0 * * * * cd /path/to/project && npm run validate:integrations || echo "Integration validation failed" | mail -s "Alert" admin@example.com
```

## Best Practices

1. **Run Before Deployment**: Always validate integrations before deploying to production
2. **Regular Monitoring**: Set up automated validation checks in production
3. **Environment Parity**: Ensure test and production environments have similar configurations
4. **Documentation**: Keep integration documentation updated when making changes
5. **Error Handling**: Implement proper error handling based on validation results

## Support

If you encounter issues with the validation suite:

1. Check the troubleshooting section above
2. Review the detailed error reports in the `reports/` directory
3. Verify all prerequisites are met
4. Check the individual integration documentation
5. Contact the development team with specific error messages

## Contributing

To add new validation tests:

1. Extend the appropriate validator class (`StripeValidator`, `SupabaseValidator`, etc.)
2. Add corresponding unit tests
3. Update this documentation
4. Test thoroughly in development environment

Example:

```typescript
// Add to StripeValidator class
async validateNewFeature(): Promise<ValidationResult> {
  try {
    // Your validation logic here
    return {
      success: true,
      message: 'New feature validation successful',
      timestamp: new Date()
    };
  } catch (error) {
    return {
      success: false,
      message: 'New feature validation failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    };
  }
}
```
