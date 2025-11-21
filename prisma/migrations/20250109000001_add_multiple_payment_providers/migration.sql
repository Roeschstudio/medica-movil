-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL', 'MERCADOPAGO');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'MERCADOPAGO_CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'MERCADOPAGO_INSTALLMENTS';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider" "PaymentProvider" NOT NULL DEFAULT 'STRIPE',
ADD COLUMN     "paypalOrderId" TEXT,
ADD COLUMN     "mercadopagoId" TEXT,
ADD COLUMN     "paymentData" JSONB,
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "payments_paypalOrderId_key" ON "payments"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_mercadopagoId_key" ON "payments"("mercadopagoId");