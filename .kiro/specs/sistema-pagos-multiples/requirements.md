# Requirements Document

## Introduction

This feature expands the current Stripe payment system to include PayPal and MercadoPago, creating a unified multi-provider payment system specifically designed for the Mexican healthcare market. The system will provide patients with multiple payment options including traditional credit/debit cards, PayPal accounts, and Mexican-specific payment methods like OXXO, SPEI transfers, and installment plans through MercadoPago.

The implementation will use free sandbox/test environments for PayPal and MercadoPago to minimize costs while providing comprehensive payment options for Mexican users.

## Requirements

### Requirement 1

**User Story:** As a patient, I want to choose from multiple payment methods when paying for my medical consultation, so that I can use the most convenient and accessible payment option for me.

#### Acceptance Criteria

1. WHEN a patient reaches the payment step THEN the system SHALL display all available payment providers (Stripe, PayPal, MercadoPago)
2. WHEN a patient selects a payment method THEN the system SHALL show provider-specific information including fees and supported payment types
3. WHEN a patient selects MercadoPago THEN the system SHALL highlight Mexican payment options (OXXO, SPEI, installments)
4. WHEN a patient selects PayPal THEN the system SHALL show PayPal-specific benefits (buyer protection, international availability)
5. WHEN a patient selects Stripe THEN the system SHALL show supported card types and instant processing information

### Requirement 2

**User Story:** As a patient, I want to pay using PayPal, so that I can use my existing PayPal account or pay with a card through PayPal's secure platform.

#### Acceptance Criteria

1. WHEN a patient selects PayPal as payment method THEN the system SHALL create a PayPal order using the sandbox environment
2. WHEN a PayPal order is created THEN the system SHALL redirect the patient to PayPal's checkout page
3. WHEN a patient completes PayPal payment THEN the system SHALL capture the payment and update the appointment status
4. WHEN a PayPal payment fails THEN the system SHALL record the failure reason and allow retry
5. WHEN a PayPal payment is successful THEN the system SHALL store the PayPal order ID for future reference

### Requirement 3

**User Story:** As a patient, I want to pay using MercadoPago, so that I can use Mexican payment methods like OXXO, SPEI transfers, or pay in installments with Mexican cards.

#### Acceptance Criteria

1. WHEN a patient selects MercadoPago THEN the system SHALL create a payment preference using MercadoPago's test environment
2. WHEN a MercadoPago preference is created THEN the system SHALL redirect to MercadoPago's checkout with Mexican payment options
3. WHEN a patient pays through OXXO THEN the system SHALL receive webhook notifications about payment status changes
4. WHEN a patient uses SPEI transfer THEN the system SHALL process immediate payment confirmation
5. WHEN a patient selects installments THEN the system SHALL support up to 12 monthly payments (MSI)
6. WHEN MercadoPago sends a webhook notification THEN the system SHALL update payment status accordingly

### Requirement 4

**User Story:** As a system administrator, I want all payments to be tracked in a unified database schema, so that I can manage and report on payments regardless of the payment provider used.

#### Acceptance Criteria

1. WHEN any payment is initiated THEN the system SHALL create a payment record with provider-specific fields
2. WHEN a Stripe payment is processed THEN the system SHALL store the Stripe payment intent ID
3. WHEN a PayPal payment is processed THEN the system SHALL store the PayPal order ID
4. WHEN a MercadoPago payment is processed THEN the system SHALL store the MercadoPago preference ID
5. WHEN payment status changes THEN the system SHALL update the unified payment record with timestamps
6. WHEN a payment is completed THEN the system SHALL update the associated appointment's payment status

### Requirement 5

**User Story:** As a developer, I want a unified payment service interface, so that I can easily manage multiple payment providers and add new ones in the future.

#### Acceptance Criteria

1. WHEN the payment service is called THEN it SHALL provide a consistent interface regardless of the provider
2. WHEN creating a payment THEN the service SHALL return a standardized result format for all providers
3. WHEN checking payment status THEN the service SHALL provide unified status checking across all providers
4. WHEN a new provider needs to be added THEN the service SHALL support extension without breaking existing functionality
5. WHEN provider-specific errors occur THEN the service SHALL normalize them into consistent error messages

### Requirement 6

**User Story:** As a patient, I want to see clear payment confirmation and next steps after successful payment, so that I know my consultation is confirmed and understand what happens next.

#### Acceptance Criteria

1. WHEN a payment is successful THEN the system SHALL redirect to a success page with appointment details
2. WHEN on the success page THEN the system SHALL display consultation information (doctor, date, time, type)
3. WHEN payment is successful THEN the system SHALL provide options to add to calendar or access chat
4. WHEN payment fails THEN the system SHALL redirect to an error page with retry options
5. WHEN on error page THEN the system SHALL display clear error message and allow payment method change

### Requirement 7

**User Story:** As a system, I want to handle webhook notifications from payment providers, so that I can update payment status in real-time even if the user closes their browser.

#### Acceptance Criteria

1. WHEN MercadoPago sends a payment webhook THEN the system SHALL verify and process the notification
2. WHEN PayPal sends a payment notification THEN the system SHALL update the payment status accordingly
3. WHEN a webhook is received THEN the system SHALL validate the source and authenticity
4. WHEN payment status is updated via webhook THEN the system SHALL trigger any necessary follow-up actions
5. WHEN webhook processing fails THEN the system SHALL log the error for manual review

### Requirement 8

**User Story:** As a business owner, I want to use free test environments for PayPal and MercadoPago, so that I can offer multiple payment options without additional setup costs during development and testing.

#### Acceptance Criteria

1. WHEN configuring PayPal THEN the system SHALL use PayPal Sandbox environment with test credentials
2. WHEN configuring MercadoPago THEN the system SHALL use MercadoPago Test environment with test tokens
3. WHEN in test mode THEN all payments SHALL be processed as test transactions
4. WHEN switching to production THEN the system SHALL support easy environment variable changes
5. WHEN using test environments THEN the system SHALL clearly indicate test mode in the UI
