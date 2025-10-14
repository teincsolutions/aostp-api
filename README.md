# AOSTP API

## S3 Photo Access Setup

### CDN Domain-based Photo Viewing (Private Bucket)

The API handles package photos through S3 with CDN domain-restricted access. Photos are not publicly accessible but can be viewed through your nginx subdomain.

#### Environment Variables

Add the following to your `.env` file:

```env
# Required for photo access via CDN domain
CDN_DOMAIN=photos.yourdomain.com  # Your CDN subdomain for photos
```

#### Automated S3 Policy Setup

Run the setup script during deployment to configure bucket policies:

```bash
./scripts/setup-s3-policy.sh
```

This script:
- Uses MinIO client (`mc`) to connect to your S3-compatible storage
- Generates a bucket policy allowing access only from your specified domain
- Applies the policy to your packages bucket
- Verifies the configuration

#### Nginx Configuration

Ensure your nginx proxy sets the correct Referer header when proxying photo requests:

```nginx
location /photos/ {
    proxy_pass https://your-s3-endpoint.com/your-bucket-name/;
    proxy_set_header Referer "https://photos.yourdomain.com/";
    proxy_set_header Host your-s3-endpoint.com;
    # Add other proxy headers as needed
}
```

#### Frontend Integration

Photos are accessible via the `url` field in package responses:

```json
{
  "id": "package-uuid",
  "photos": [
    {
      "id": "photo-uuid",
      "url": "https://your-s3-endpoint.com/bucket/packages/photo-key.jpg",
      "key": "packages/photo-key.jpg"
    }
  ]
}
```

The nginx proxy will serve these URLs with the correct Referer header.

#### Troubleshooting

- **Photos not loading**: Check nginx Referer header configuration
- **403 Forbidden**: Verify the domain in `.env` matches nginx configuration
- **Policy not applied**: Run `./scripts/setup-s3-policy.sh` after environment updates
