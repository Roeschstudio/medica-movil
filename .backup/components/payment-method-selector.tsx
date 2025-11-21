"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentService } from "@/lib/payments/PaymentService";
import { PaymentProvider, PaymentProviderType } from "@/lib/payments/types";
import {
  AlertCircle,
  Building2,
  Check,
  CreditCard,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface PaymentMethodSelectorProps {
  selectedProvider: PaymentProviderType | null;
  onProviderChange: (provider: PaymentProviderType) => void;
  price: number;
  onPaymentInitiate: (provider: PaymentProviderType) => void;
  isProcessing?: boolean;
  error?: string | null;
}

export function PaymentMethodSelector({
  selectedProvider,
  onProviderChange,
  price,
  onPaymentInitiate,
  isProcessing = false,
  error = null,
}: PaymentMethodSelectorProps) {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const paymentService = new PaymentService();

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const availableProviders = paymentService.getAvailableProviders();
        setProviders(availableProviders);
      } catch (error) {
        console.error("Error loading payment providers:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProviders();
  }, []);

  const getProviderIcon = (providerId: PaymentProviderType) => {
    switch (providerId) {
      case "stripe":
        return CreditCard;
      case "paypal":
        return CreditCard; // We'll use CreditCard for now, can be updated with PayPal icon
      case "mercadopago":
        return Building2;
      default:
        return CreditCard;
    }
  };

  const getProcessingTime = (providerId: PaymentProviderType) => {
    switch (providerId) {
      case "stripe":
        return "Inmediato";
      case "paypal":
        return "Inmediato";
      case "mercadopago":
        return "Inmediato - 24 horas";
      default:
        return "Inmediato";
    }
  };

  const isPopular = (providerId: PaymentProviderType) => {
    return providerId === "stripe"; // Stripe is most popular for now
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Cargando métodos de pago...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-foreground">Método de pago</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {providers.map((provider) => {
          const Icon = getProviderIcon(provider.id);
          const isSelected = selectedProvider === provider.id;

          return (
            <Card
              key={provider.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "ring-2 ring-primary bg-primary/5"
                  : "hover:shadow-md hover:bg-muted/50"
              }`}
              onClick={() => onProviderChange(provider.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{provider.displayName}</h4>
                      {isPopular(provider.id) && (
                        <Badge variant="default" className="text-xs">
                          Más usado
                        </Badge>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {provider.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        ⏱️ {getProcessingTime(provider.id)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        💳 {provider.fees}
                      </span>
                    </div>

                    {/* Supported methods */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.supportedMethods.slice(0, 3).map((method) => (
                        <Badge
                          key={method}
                          variant="outline"
                          className="text-xs"
                        >
                          {method}
                        </Badge>
                      ))}
                      {provider.supportedMethods.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.supportedMethods.length - 3} más
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Provider-specific information */}
      {selectedProvider === "stripe" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Pago con tarjeta:</strong> Procesamiento inmediato y seguro.
            Acepta Visa, Mastercard y American Express. Tu cita se confirmará al
            instante.
          </p>
        </div>
      )}

      {selectedProvider === "paypal" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>PayPal:</strong> Paga con tu cuenta PayPal o tarjeta a
            través de PayPal. Protección al comprador incluida. Procesamiento
            inmediato.
          </p>
        </div>
      )}

      {selectedProvider === "mercadopago" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>MercadoPago:</strong> Opciones de pago mexicanas incluyendo
            OXXO, SPEI, tarjetas y meses sin intereses. Ideal para pagos
            locales.
          </p>
        </div>
      )}

      {/* Payment initiation button */}
      {selectedProvider && (
        <Button
          onClick={() => onPaymentInitiate(selectedProvider)}
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            `Pagar $${price.toFixed(2)} MXN`
          )}
        </Button>
      )}
    </div>
  );
}
