/*
  Warnings:

  - The values [CONSOLIDATED,IN_WAREHOUSE,CANCELLED] on the enum `PackageStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `status` on the `PackageItem` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PackageStatus_new" AS ENUM ('RECEIVED', 'ASSIGNED', 'SHIPPED', 'ARRIVED', 'RELEASED');
ALTER TABLE "public"."Package" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Package" ALTER COLUMN "status" TYPE "PackageStatus_new" USING ("status"::text::"PackageStatus_new");
ALTER TYPE "PackageStatus" RENAME TO "PackageStatus_old";
ALTER TYPE "PackageStatus_new" RENAME TO "PackageStatus";
DROP TYPE "public"."PackageStatus_old";
ALTER TABLE "Package" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';
COMMIT;

-- DropIndex
DROP INDEX "public"."PackageItem_status_idx";

-- AlterTable
ALTER TABLE "PackageItem" DROP COLUMN "status";

-- DropEnum
DROP TYPE "public"."PackageItemStatus";
