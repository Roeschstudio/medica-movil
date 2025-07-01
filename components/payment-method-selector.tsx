
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Building2, 
  Banknote,
  Check
} from 'lucide-react';
import { MexicanPaymentMethod, MEXICAN_PAYMENT_METHODS } from '@/lib/stripe';

interface PaymentMethodSelectorProps {
  selectedMethod: MexicanPaymentMethod;
  onMethodChange: (method: MexicanPaymentMethod) => void;
  price: number;
}

export function PaymentMethodSelector({ 
  selectedMethod, 
  onMethodChange, 
  price 
}: PaymentMethodSelectorProps) {
  const paymentMethods = [
    {
      id: MEXICAN_PAYMENT_METHODS.CARD,
      name: 'Tarjeta de Crédito/Débito',
      description: 'Visa, Mastercard, American Express',
      icon: CreditCard,
      processingTime: 'Inmediato',
      fee: 'Sin comisión adicional',
      popular: true
    },
    {
      id: MEXICAN_PAYMENT_METHODS.OXXO,
      name: 'OXXO',
      description: 'Pago en efectivo en tiendas OXXO',
      icon: Building2,
      processingTime: 'Hasta 24 horas',
      fee: '+$12 MXN comisión',
      popular: false
    },
    {
      id: MEXICAN_PAYMENT_METHODS.SPEI,
      name: 'Transferencia SPEI',
      description: 'Transferencia bancaria interbancaria',
      icon: Banknote,
      processingTime: 'Hasta 3 horas',
      fee: '+$5 MXN comisión',
      popular: false
    }
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground">Método de pago</h3>
      
      <div className="space-y-3">
        {paymentMethods.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.id;
          
          return (
            <Card
              key={method.id}
              className={`cursor-pointer transition-all ${
                isSelected 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:shadow-md hover:bg-muted/50'
              }`}
              onClick={() => onMethodChange(method.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{method.name}</h4>
                      {method.popular && (
                        <Badge variant="default" className="text-xs">
                          Más usado
                        </Badge>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {method.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-xs text-muted-foreground">
                        ⏱️ {method.processingTime}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        💳 {method.fee}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Información adicional según el método */}
      {selectedMethod === MEXICAN_PAYMENT_METHODS.OXXO && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Pago en OXXO:</strong> Recibirás un código de barras para pagar en cualquier tienda OXXO. 
            Tu cita se confirmará una vez que se procese el pago (máximo 24 horas).
          </p>
        </div>
      )}

      {selectedMethod === MEXICAN_PAYMENT_METHODS.SPEI && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>Transferencia SPEI:</strong> Recibirás los datos bancarios para realizar la transferencia. 
            La confirmación es automática una vez recibida (máximo 3 horas en horario bancario).
          </p>
        </div>
      )}
    </div>
  );
}
