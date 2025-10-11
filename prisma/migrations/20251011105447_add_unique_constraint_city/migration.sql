/*
  Warnings:

  - A unique constraint covering the columns `[name,country]` on the table `City` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."City_name_idx";

-- CreateIndex
CREATE UNIQUE INDEX "City_name_country_key" ON "public"."City"("name", "country");
