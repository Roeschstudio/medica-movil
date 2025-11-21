# Payment System Setup Guide

This guide explains how to configure the multiple payment providers for the healthcare platform.

## Environment Variables

Add the following environment variables to your `.env` file:

### Stripe Configuration

```env
# Stripe (existing)
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### PayPal Configuration (Sandbox)

```env
# PayPal Sandbox
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
```

### MercadoPago Configuration (Test)

```env
# MercadoPago Test
MERCADOPAGO_PUBLIC_KEY=TEST-your_public_key
MERCADOPAGO_ACCESS_TOKEN=TEST-your_access_token
MERCADOPAGO_WEBHOOK_SECRET=your_webhook_secret
```

### Monitoring

```env
# For payment monitoring cron job
CRON_SECRET=your_secure_cron_secret
```

## Provider Setup Instructions

### 1. Stripe Setup

Stripe should already be configured. No additional setup needed.

### 2. PayPal Sandbox Setup

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Create a new sandbox application
3. Get your Client ID and Client Secret from the app details
4. Set up webhooks pointing to: `https://yourdomain.com/api/payments/paypal/webhook`
5. Subscribe to these webhook events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `CHECKOUT.ORDER.APPROVED`

### 3. MercadoPago Test Setup

1. Go to [MercadoPago Developers](https://www.mercadopago.com.mx/developers/)
2. Create a new application
3. Get your test credentials (Public Key and Access Token)
4. Set up webhooks pointing to: `https://yourdomain.com/api/payments/mercadopago/webhook`
5. Subscribe to payment events

## Testing the Setup

### 1. Test Payment Provider Registration

```bash
# Check if all providers are loaded
curl https://yourdomain.com/api/payments/monitor
```

### 2. Test Payment Creation

#### Stripe Test

```bash
curl -X POST https://yourdomain.com/api/payments/stripe/create-session \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "your_appointment_id"}'
```

#### PayPal Test

```bash
curl -X POST https://yourdomain.com/api/payments/paypal/create-order \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "your_appointment_id"}'
```

#### MercadoPago Test

```bash
curl -X POST https://yourdomain.com/api/payments/mercadopago/create-preference \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "your_appointment_id"}'
```

## Test Cards and Accounts

### Stripe Test Cards

- Visa: `4242424242424242`
- Mastercard: `5555555555554444`
- Declined: `4000000000000002`

### PayPal Sandbox Accounts

Create test buyer and seller accounts in the PayPal sandbox.

### MercadoPago Test Cards

- Approved: `5031755734530604`
- Declined: `5031755734530001`

## Webhook URLs

Make sure these webhook URLs are accessible:

- Stripe: `https://yourdomain.com/api/payments/webhook`
- PayPal: `https://yourdomain.com/api/payments/paypal/webhook`
- MercadoPago: `https://yourdomain.com/api/payments/mercadopago/webhook`

## Monitoring Setup

Set up a cron job to monitor payment status:

```bash
# Add to crontab - runs every 5 minutes
*/5 * * * * curl -X POST https://yourdomain.com/api/payments/monitor \
  -H "Authorization: Bearer your_cron_secret"
```

## Production Deployment

When moving to production:

1. **Stripe**: Update to live keys
2. **PayPal**: Change `PAYPAL_MODE` to `live` and use production credentials
3. **MercadoPago**: Replace test credentials with production credentials
4. Update webhook URLs to production endpoints
5. Test all payment flows thoroughly

## Troubleshooting

### Common Issues

1. **Provider not found**: Check that environment variables are set correctly
2. **Webhook failures**: Verify webhook URLs are accessible and have correct signatures
3. **Payment status not updating**: Check the monitoring cron job is running

### Logs

Check application logs for payment-related errors:

- Payment creation failures
- Webhook processing errors
- Provider API errors

### Support

For provider-specific issues:

- **Stripe**: Check Stripe Dashboard logs
- **PayPal**: Check PayPal Developer Dashboard
- **MercadoPago**: Check MercadoPago Developer Panel
