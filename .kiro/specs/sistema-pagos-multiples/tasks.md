# Implementation Plan

- [x] 1. Update database schema and environment configuration

  - ✅ Update Prisma schema to support multiple payment providers
  - ✅ Add new fields for PayPal and MercadoPago IDs
  - ✅ Create database migration for schema changes
  - ✅ Add environment variables for PayPal and MercadoPago test credentials
  - _Requirements: 4.1, 4.2, 4.4, 8.1, 8.2_

- [x] 2. Create unified payment service architecture
- [x] 2.1 Implement core payment service interfaces and types

  - ✅ Create PaymentProvider, PaymentRequest, and PaymentResult interfaces
  - ✅ Define provider configuration types
  - ✅ Implement base PaymentService class with provider registry
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 2.2 Create abstract payment provider base class

  - ✅ Implement BasePaymentProvider with common functionality
  - ✅ Define standard methods for create, capture, and status checking
  - ✅ Add error normalization and logging utilities
  - _Requirements: 5.1, 5.4, 5.5_

- [x] 3. Implement PayPal payment provider
- [x] 3.1 Create PayPal API integration utilities

  - ✅ Implement PayPal access token management
  - ✅ Create PayPal API client with error handling
  - ✅ Add PayPal-specific data transformation utilities
  - _Requirements: 2.1, 2.2, 8.1_

- [x] 3.2 Implement PayPal payment provider class

  - ✅ Create PayPalProvider extending BasePaymentProvider
  - ✅ Implement createPayment method for PayPal orders
  - ✅ Add payment capture functionality
  - ✅ Implement status checking and error handling
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 4. Implement MercadoPago payment provider
- [x] 4.1 Create MercadoPago API integration utilities

  - ✅ Implement MercadoPago API client
  - ✅ Create preference data transformation utilities
  - ✅ Add Mexican payment method configuration
  - _Requirements: 3.1, 3.2, 3.5, 8.2_

- [x] 4.2 Implement MercadoPago payment provider class

  - ✅ Create MercadoPagoProvider extending BasePaymentProvider
  - ✅ Implement createPayment method for payment preferences
  - ✅ Add support for OXXO, SPEI, and installment payments
  - ✅ Implement status checking and webhook data processing
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Create PayPal API routes
- [x] 5.1 Implement PayPal order creation API route

  - ✅ Create /api/payments/paypal/create-order endpoint
  - ✅ Add authentication and appointment validation
  - ✅ Implement PayPal order creation with proper error handling
  - ✅ Store payment record in database with PayPal order ID
  - _Requirements: 2.1, 2.2, 4.2, 4.3_

- [x] 5.2 Implement PayPal payment capture API route

  - ✅ Create /api/payments/paypal/capture endpoint
  - ✅ Add PayPal payment capture functionality
  - ✅ Update payment status and appointment confirmation
  - ✅ Handle capture errors and edge cases
  - _Requirements: 2.2, 2.5, 4.4, 4.5_

- [x] 6. Create MercadoPago API routes
- [x] 6.1 Implement MercadoPago preference creation API route

  - ✅ Create /api/payments/mercadopago/create-preference endpoint
  - ✅ Add authentication and appointment validation
  - ✅ Implement MercadoPago preference creation with Mexican payment methods
  - ✅ Store payment record with MercadoPago preference ID
  - _Requirements: 3.1, 3.2, 4.2, 4.3_

- [x] 6.2 Implement MercadoPago webhook handler

  - ✅ Create /api/payments/mercadopago/webhook endpoint
  - ✅ Add webhook signature verification
  - ✅ Implement payment status updates from MercadoPago notifications
  - ✅ Handle OXXO and SPEI payment confirmations
  - _Requirements: 3.3, 3.6, 7.1, 7.2, 7.3_

- [x] 7. Enhance existing Stripe integration
- [x] 7.1 Update Stripe provider to use new architecture

  - ✅ Refactor existing Stripe code to extend BasePaymentProvider
  - ✅ Update Stripe payment creation to use unified interfaces
  - ✅ Enhance error handling and metadata storage
  - _Requirements: 4.1, 4.4, 5.1, 5.2_

- [x] 7.2 Update Stripe webhook handler

  - ✅ Enhance existing Stripe webhook to use unified payment updates
  - ✅ Add better error handling and logging
  - ✅ Ensure compatibility with new payment schema
  - _Requirements: 4.4, 4.5, 7.4, 7.5_

- [x] 8. Create enhanced payment method selector component
- [x] 8.1 Implement multi-provider payment selector UI

  - ✅ Update PaymentMethodSelector to support multiple providers
  - ✅ Add provider-specific information display (fees, processing times)
  - ✅ Implement provider selection with radio buttons
  - ✅ Add provider-specific informational sections
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8.2 Add payment processing and redirect logic

  - ✅ Implement payment initiation for selected provider
  - ✅ Add loading states and error handling
  - ✅ Implement redirect to provider checkout pages
  - ✅ Add payment method change functionality on errors
  - _Requirements: 1.1, 6.4, 6.5_

- [x] 9. Create payment result pages
- [x] 9.1 Implement payment success page

  - ✅ Create /pago/exito page with appointment details display
  - ✅ Add payment confirmation information
  - ✅ Implement next steps (calendar, chat access)
  - ✅ Handle multiple provider success scenarios
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9.2 Implement payment error page

  - ✅ Create /pago/cancelado page with error information
  - ✅ Add retry functionality with payment method selection
  - ✅ Display clear error messages and suggested actions
  - ✅ Implement navigation back to payment selection
  - _Requirements: 6.4, 6.5_

- [x] 10. Add payment status checking functionality
- [x] 10.1 Implement unified payment status API

  - ✅ Create /api/payments/status endpoint for all providers
  - ✅ Add real-time status checking across providers
  - ✅ Implement polling mechanism for pending payments
  - ✅ Add status change notifications
  - _Requirements: 5.2, 7.4, 7.5_

- [x] 10.2 Add payment status monitoring utilities

  - ✅ Create payment status checking utilities
  - ✅ Implement automatic status updates for pending payments
  - ✅ Add payment timeout handling
  - ✅ Create payment reconciliation tools
  - _Requirements: 4.5, 7.4, 7.5_

- [x] 11. Implement comprehensive error handling
- [x] 11.1 Create payment error classification system

  - ✅ Implement error categorization (provider, network, validation, system)
  - ✅ Add error recovery strategies and retry logic
  - ✅ Create user-friendly error messages
  - ✅ Implement admin error notifications
  - _Requirements: 5.5, 6.4, 6.5_

- [x] 11.2 Add payment logging and monitoring

  - ✅ Implement comprehensive payment operation logging
  - ✅ Add payment metrics collection (success rates, processing times)
  - ✅ Create payment failure analysis tools
  - ✅ Add real-time payment monitoring dashboard
  - _Requirements: 4.5, 7.5_

- [x] 12. Create comprehensive test suite
- [x] 12.1 Implement unit tests for payment services

  - ✅ Create tests for PaymentService class and provider interfaces
  - ✅ Add tests for PayPal and MercadoPago provider implementations
  - ✅ Test error handling and edge cases
  - ✅ Add mock provider tests
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 12.2 Implement integration tests for API routes

  - ✅ Create tests for all payment API endpoints
  - ✅ Add webhook processing tests with mock data
  - ✅ Test database integration and payment record creation
  - ✅ Add cross-provider compatibility tests
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2_

- [x] 12.3 Create end-to-end payment flow tests

  - ✅ Implement complete payment journey tests for each provider
  - ✅ Add UI component testing with payment interactions
  - ✅ Test success and failure scenarios
  - ✅ Add mobile responsiveness tests
  - _Requirements: 1.1, 6.1, 6.4_

- [x] 13. Add security and validation enhancements
- [x] 13.1 Implement webhook security verification

  - ✅ Add PayPal webhook signature verification
  - ✅ Implement MercadoPago webhook authentication
  - ✅ Add webhook replay protection and idempotency
  - ✅ Create secure webhook processing pipeline
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 13.2 Add payment data validation and sanitization

  - ✅ Implement comprehensive input validation for all payment data
  - ✅ Add rate limiting for payment API endpoints
  - ✅ Create payment amount and currency validation
  - ✅ Add user authorization checks for payment operations
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 14. Create deployment and configuration management
- [x] 14.1 Set up environment configuration

  - ✅ Configure PayPal sandbox credentials and settings
  - ✅ Set up MercadoPago test environment variables
  - ✅ Create environment-specific provider configurations
  - ✅ Add configuration validation and health checks
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 14.2 Implement feature flags and gradual rollout
  - ✅ Create feature flags for enabling new payment providers
  - ✅ Implement A/B testing for payment method selection
  - ✅ Add provider availability monitoring
  - ✅ Create rollback procedures for payment provider issues
  - _Requirements: 8.5_
