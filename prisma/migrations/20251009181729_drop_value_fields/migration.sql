/*
  Warnings:

  - You are about to drop the column `value` on the `Package` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `PackageItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Package" DROP COLUMN "value";

-- AlterTable
ALTER TABLE "public"."PackageItem" DROP COLUMN "value";
