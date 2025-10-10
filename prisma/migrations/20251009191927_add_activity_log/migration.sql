-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "correlationId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "method" TEXT,
    "url" TEXT,
    "statusCode" INTEGER,
    "responseTime" INTEGER,
    "metadata" JSONB,
    "error" TEXT,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_level_idx" ON "public"."ActivityLog"("level");

-- CreateIndex
CREATE INDEX "ActivityLog_timestamp_idx" ON "public"."ActivityLog"("timestamp");

-- CreateIndex
CREATE INDEX "ActivityLog_correlationId_idx" ON "public"."ActivityLog"("correlationId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "public"."ActivityLog"("userId");

-- AddForeignKey
ALTER TABLE "public"."ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
