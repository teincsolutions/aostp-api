import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  size?: number;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly region: string;
  private readonly defaultBucket: string;
  private readonly endpoint?: string;
  private readonly cdnDomain?: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.defaultBucket = this.configService.getOrThrow<string>(
      'AWS_PACKAGES_BUCKET_NAME',
    );
    this.endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    this.cdnDomain = this.configService.get<string>('CDN_DOMAIN');

    const s3Config: any = {
      region: this.region,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    };

    if (this.endpoint) {
      s3Config.endpoint = this.endpoint;
      s3Config.forcePathStyle = true; // Path style addressing for Hetzner compatibility
    }

    this.s3Client = new S3Client(s3Config);

    this.logger.log(
      `S3 Service initialized with default bucket: ${this.defaultBucket}${this.endpoint ? ` and custom endpoint: ${this.endpoint}` : ''}`,
    );
    this.logger.log(
      `S3 Configuration: region=${this.region}, defaultBucket=${this.defaultBucket}, endpoint=${this.endpoint || 'us-east-1 (AWS default)'}, cdnDomain=${this.cdnDomain || 'Not configured'}`,
    );
  }

  /**
   * Generate a presigned URL for direct client upload
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600, // 1 hour default
  ): Promise<PresignedUrlResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.defaultBucket,
        Key: key,
        ContentType: contentType,
        // Note: Hetzner Object Storage may not support ServerSideEncryption
        // ServerSideEncryption: 'AES256',
        Metadata: {
          'uploaded-via': 'presigned-url',
          'upload-timestamp': new Date().toISOString(),
        },
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(`Generated presigned upload URL for key: ${key}`);

      return {
        uploadUrl,
        key,
        expiresIn,
      };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL for ${key}`, error);
      throw new Error(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for file download
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
    bucketName: string = this.defaultBucket,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const downloadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      this.logger.log(`Generated presigned download URL for key: ${key}`);
      return downloadUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned download URL for ${key}`,
        error,
      );
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Upload a file directly to S3 (server-side upload)
   */
  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<S3UploadResult> {
    return this.uploadFileWithBucket(
      this.defaultBucket,
      key,
      buffer,
      contentType,
      metadata,
    );
  }

  /**
   * Upload a file directly to S3 with specific bucket (server-side upload)
   */
  async uploadFileWithBucket(
    bucketName: string,
    key: string,
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<S3UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Note: Hetzner Object Storage may not support ServerSideEncryption
        // ServerSideEncryption: 'AES256',
        Metadata: {
          'uploaded-via': 'server-side',
          'upload-timestamp': new Date().toISOString(),
          ...metadata,
        },
      });

      await this.s3Client.send(command);

      // Use CDN URL for client-accessible URLs, but log the direct S3 URL for debugging
      const cdnUrl = this.generateCdnUrl(bucketName, key);
      const directS3Url = this.endpoint
        ? `${this.endpoint}/${bucketName}/${key}`
        : `https://${bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      this.logger.log(
        `File uploaded successfully: ${key} to bucket ${bucketName}`,
      );
      this.logger.log(`CDN URL: ${cdnUrl}, Direct S3 URL: ${directS3Url}`);

      return {
        key,
        url: cdnUrl, // Return CDN URL for client use
        bucket: bucketName,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload file ${key} to bucket ${bucketName}`,
        {
          error: error.message,
          name: error.name,
          code: error.name,
          httpStatusCode: error.$metadata?.httpStatusCode,
          serviceId: error.$metadata?.serviceId,
          metadataRegion: error.$metadata?.region,
          retryAttempts: error.$metadata?.attempts,
          extendedRequestId: error.$metadata?.extendedRequestId,
          cfId: error.$metadata?.cfId,
          stack: error.stack,
          bucket: bucketName,
          key: key,
          s3Config: {
            region: this.region,
            endpoint: this.endpoint,
            bucket: bucketName,
          },
        },
      );

      // Log additional details for S3-compatible services
      if (error.name === 'InvalidArgument' || error.name === 'UnknownError') {
        this.logger.error(
          'S3-compatible service specific error. Please check:',
          {
            'S3 Endpoint': this.endpoint,
            Region: this.region,
            Bucket: bucketName,
            'Possible solutions': [
              '1. Check if bucket exists',
              '2. Verify endpoint URL format',
              '3. Check credentials',
              '4. Verify region is correct for Hetzner S3',
              '5. Check if virtual host or path style addressing is required',
            ],
          },
        );
      }

      throw new Error(
        `Failed to upload file: ${error.name} - ${error.message}`,
      );
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.defaultBucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}`, error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.defaultBucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      this.logger.error(`Failed to check file existence ${key}`, error);
      throw new Error(`Failed to check file existence: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<any> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.defaultBucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return {
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
        etag: response.ETag,
      };
    } catch (error) {
      this.logger.error(`Failed to get file metadata ${key}`, error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Generate a unique key for file storage
   */
  generateFileKey(
    prefix: string,
    originalFileName: string,
    userId?: string,
  ): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const fileExtension = originalFileName.split('.').pop();

    const userPrefix = userId ? `${userId}/` : '';
    const fileName = `${timestamp}_${randomSuffix}.${fileExtension}`;

    return `${prefix}/${userPrefix}${fileName}`;
  }

  /**
   * Validate file type and size
   */
  validateFile(
    contentType: string,
    fileSize: number,
    allowedTypes: string[] = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    maxSize: number = 10 * 1024 * 1024, // 10MB default
  ): { valid: boolean; error?: string } {
    if (!allowedTypes.includes(contentType)) {
      return {
        valid: false,
        error: `File type ${contentType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      };
    }

    if (fileSize > maxSize) {
      return {
        valid: false,
        error: `File size ${fileSize} exceeds maximum allowed size of ${maxSize} bytes`,
      };
    }

    return { valid: true };
  }

  /**
   * Health check for S3 service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.defaultBucket,
        MaxKeys: 1,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      this.logger.error('S3 health check failed', error);
      return false;
    }
  }

  /**
   * Generate CDN URL for a file (used for photo URLs)
   */
  generateCdnUrl(bucketName: string, key: string): string {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${bucketName}/${key}`;
    }
    // Fallback to direct S3 URL if CDN domain is not configured
    return this.endpoint
      ? `${this.endpoint}/${bucketName}/${key}`
      : `https://${bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Get public URL for a file (if bucket is configured for public access)
   */
  getPublicUrl(key: string): string {
    return `https://${this.defaultBucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
