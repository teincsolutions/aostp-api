-- AlterTable
ALTER TABLE "public"."Container" ALTER COLUMN "departureCityId" DROP DEFAULT,
ALTER COLUMN "destinationCityId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Package" ADD COLUMN     "shippingCost" DOUBLE PRECISION,
ADD COLUMN     "shippingRateId" TEXT;

-- AlterTable
ALTER TABLE "public"."PackingList" ADD COLUMN     "totalShippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
