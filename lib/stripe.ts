
import Stripe from 'stripe';

// En desarrollo, usar una clave de prueba por defecto si no está configurada
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_development_key';

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('STRIPE_SECRET_KEY is required in production environment');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-05-28.basil',
});

// Métodos de pago específicos para México
export const MEXICAN_PAYMENT_METHODS = {
  CARD: 'card',
  OXXO: 'oxxo',
  SPEI: 'customer_balance'
} as const;

export type MexicanPaymentMethod = typeof MEXICAN_PAYMENT_METHODS[keyof typeof MEXICAN_PAYMENT_METHODS];

// Configuración para diferentes tipos de pago mexicanos
export const getPaymentMethodConfig = (method: MexicanPaymentMethod) => {
  switch (method) {
    case MEXICAN_PAYMENT_METHODS.CARD:
      return {
        payment_method_types: ['card' as const],
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never' as const
        }
      };
    case MEXICAN_PAYMENT_METHODS.OXXO:
      return {
        payment_method_types: ['oxxo' as const],
        payment_method_options: {
          oxxo: {
            expires_after_days: 3
          }
        }
      };
    case MEXICAN_PAYMENT_METHODS.SPEI:
      return {
        payment_method_types: ['customer_balance' as const],
        payment_method_options: {
          customer_balance: {
            funding_type: 'bank_transfer' as const,
            bank_transfer: {
              type: 'mx_bank_transfer' as const
            }
          }
        }
      };
    default:
      return {
        payment_method_types: ['card' as const],
        automatic_payment_methods: {
          enabled: true
        }
      };
  }
};

// Calcular comisión de Stripe para México
export const calculateStripeCommission = (amount: number, method: MexicanPaymentMethod): number => {
  // Comisiones aproximadas de Stripe en México (en centavos)
  switch (method) {
    case MEXICAN_PAYMENT_METHODS.CARD:
      return Math.round(amount * 0.036 + 300); // 3.6% + $3 MXN
    case MEXICAN_PAYMENT_METHODS.OXXO:
      return Math.round(amount * 0.039 + 1200); // 3.9% + $12 MXN
    case MEXICAN_PAYMENT_METHODS.SPEI:
      return Math.round(amount * 0.007 + 500); // 0.7% + $5 MXN
    default:
      return Math.round(amount * 0.036 + 300);
  }
};

// Crear metadata para citas médicas
export const createAppointmentMetadata = (appointmentData: {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  consultationType: string;
  scheduledAt: string;
}) => ({
  type: 'medical_appointment',
  appointment_id: appointmentData.appointmentId,
  doctor_id: appointmentData.doctorId,
  patient_id: appointmentData.patientId,
  consultation_type: appointmentData.consultationType,
  scheduled_at: appointmentData.scheduledAt
});
