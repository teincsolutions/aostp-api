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
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName =
      this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });

    this.logger.log(`S3 Service initialized for bucket: ${this.bucketName}`);
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
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
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
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
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
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          'uploaded-via': 'server-side',
          'upload-timestamp': new Date().toISOString(),
          ...metadata,
        },
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        key,
        url,
        bucket: this.bucketName,
        size: buffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}`, error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
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
        Bucket: this.bucketName,
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
        Bucket: this.bucketName,
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
        Bucket: this.bucketName,
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
   * Get public URL for a file (if bucket is configured for public access)
   */
  getPublicUrl(key: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
