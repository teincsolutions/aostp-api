-- Update all packages with old status values to RECEIVED
UPDATE "Package" SET status = 'RECEIVED' WHERE status IN ('IN_WAREHOUSE', 'CONSOLIDATED', 'CANCELLED');

-- Update any PackageItem statuses to RECEIVED
UPDATE "PackageItem" SET status = 'RECEIVED' WHERE status IN ('CONSOLIDATED');
