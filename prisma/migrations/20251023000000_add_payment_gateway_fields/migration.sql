-- Create the PaymentGatewayStatus enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "public"."PaymentGatewayStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add gateway integration fields to Payment table
ALTER TABLE "public"."Payment" ADD COLUMN "gatewayTransactionId" TEXT;
ALTER TABLE "public"."Payment" ADD COLUMN "gatewayStatus" "public"."PaymentGatewayStatus";
