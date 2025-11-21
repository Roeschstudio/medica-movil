// Core payment service types and interfaces

export type PaymentProviderType = "stripe" | "paypal" | "mercadopago";

export interface PaymentProvider {
  id: PaymentProviderType;
  name: string;
  displayName: string;
  icon: string;
  description: string;
  fees: string;
  available: boolean;
  supportedMethods: string[];
}

export interface PaymentRequest {
  appointmentId: string;
  amount: number;
  currency: string;
  description: string;
  patientEmail: string;
  patientName: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  checkoutUrl?: string;
  error?: string;
  provider: PaymentProviderType;
  metadata?: Record<string, any>;
}

export interface PaymentStatus {
  id: string;
  status: "pending" | "completed" | "failed" | "cancelled" | "refunded";
  provider: PaymentProviderType;
  amount: number;
  currency: string;
  paidAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface ProviderConfig {
  stripe: {
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  paypal: {
    clientId: string;
    clientSecret: string;
    mode: "sandbox" | "live";
    webhookId: string;
  };
  mercadopago: {
    publicKey: string;
    accessToken: string;
    webhookSecret: string;
  };
}

export interface PaymentError {
  code: string;
  message: string;
  provider: PaymentProviderType;
  retryable: boolean;
  suggestedActions: string[];
  metadata?: Record<string, any>;
}

export interface WebhookData {
  provider: PaymentProviderType;
  eventType: string;
  paymentId: string;
  status: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, any>;
}
