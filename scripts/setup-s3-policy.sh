#!/bin/bash
set -e

# S3/MinIO Bucket Policy Setup Script
# This script configures S3 bucket policy for domain-restricted photo access
# Usage: ./setup-s3-policy.sh

echo "🚀 Setting up S3 bucket policy for packages..."

# Environment variables
BUCKET_NAME="${AWS_PACKAGES_BUCKET_NAME}"
CDN_DOMAIN="${CDN_DOMAIN}"
S3_ENDPOINT="${AWS_S3_ENDPOINT}"
S3_ALIAS="packages-s3"

# Validate required environment variables
if [ -z "$CDN_DOMAIN" ]; then
    echo "❌ Error: CDN_DOMAIN environment variable is required"
    exit 1
fi

if [ -z "$BUCKET_NAME" ] || [ -z "$S3_ENDPOINT" ]; then
    echo "❌ Error: AWS_PACKAGES_BUCKET_NAME and AWS_S3_ENDPOINT are required"
    exit 1
fi

# Check if mc (MinIO client) is available
if ! command -v mc &> /dev/null; then
    echo "❌ Error: mc (MinIO client) is not installed or not in PATH"
    exit 1
fi

# Generate dynamic policy JSON
POLICY_FILE="/tmp/package-photos-policy.json"
cat > "$POLICY_FILE" << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowDomainBasedAccess",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringLike": {
          "aws:Referer": [
            "https://${CDN_DOMAIN}/*"
          ]
        }
      }
    }
  ]
}
EOF

echo "📄 Generated policy for domain: https://${CDN_DOMAIN}/*"
echo "🎯 Target bucket: ${BUCKET_NAME}"

# Configure mc alias (add/update S3 connection)
echo "🔗 Configuring mc alias: ${S3_ALIAS}"
mc alias set "${S3_ALIAS}" "${S3_ENDPOINT}" "${AWS_ACCESS_KEY_ID}" "${AWS_SECRET_ACCESS_KEY}" --api S3v4

# Test connection and bucket existence
echo "✅ Testing connection and bucket..."
if ! mc ls "${S3_ALIAS}/${BUCKET_NAME}" --quiet 2>/dev/null; then
    echo "⚠️  Bucket ${BUCKET_NAME} does not exist or is not accessible"
    echo "Creating bucket..."
    mc mb "${S3_ALIAS}/${BUCKET_NAME}"
fi

# Apply bucket policy
echo "📋 Applying bucket policy..."
mc anonymous set-json "${POLICY_FILE}" "${S3_ALIAS}/${BUCKET_NAME}"

# Verify policy was applied
echo "🔍 Verifying policy..."
mc anonymous get-json "${S3_ALIAS}/${BUCKET_NAME}"

# Clean up
rm -f "$POLICY_FILE"

echo ""
echo "🎉 S3 bucket policy setup completed successfully!"
echo "✅ Domain ${CDN_DOMAIN} now has access to photos in ${BUCKET_NAME}"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure your nginx proxy sets the correct Referer header"
echo "   2. Test photo access from your CDN domain"
echo ""
echo "🐛 Troubleshooting:"
echo "   - If photos don't load, check nginx Referer header configuration"
echo "   - Verify CDN_DOMAIN matches nginx reverse proxy domain"
