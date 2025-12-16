-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('PAID_IN_GHANA', 'PAID_IN_CHINA');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentSource" "PaymentSource" NOT NULL DEFAULT 'PAID_IN_GHANA',
ADD COLUMN     "referenceDocumentKey" TEXT;

-- CreateIndex
CREATE INDEX "Payment_paymentSource_idx" ON "Payment"("paymentSource");
