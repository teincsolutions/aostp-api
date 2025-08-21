/*
  Warnings:

  - A unique constraint covering the columns `[idType,idNumber]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."IdType" ADD VALUE 'VOTER_ID';

-- CreateIndex
CREATE INDEX "Customer_idNumber_idx" ON "public"."Customer"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_idType_idNumber_key" ON "public"."Customer"("idType", "idNumber");
