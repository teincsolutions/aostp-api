import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { S3Service, S3UploadResult } from '../../providers/storage/s3.service';
import {
  UploadPackageDto,
  UploadUserDto,
  UploadLogDto,
  UploadPaymentDto,
  UploadGenericDto,
  BucketType,
} from './dto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly packagesBucket: string;
  private readonly usersBucket: string;
  private readonly logsBucket: string;
  private readonly paymentsBucket: string;

  constructor(
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {
    this.packagesBucket = this.configService.getOrThrow<string>(
      'AWS_PACKAGES_BUCKET_NAME',
    );
    this.usersBucket = this.configService.getOrThrow<string>(
      'AWS_USERS_BUCKET_NAME',
    );
    this.logsBucket = this.configService.getOrThrow<string>(
      'AWS_LOGS_BUCKET_NAME',
    );
    // For payments, we'll use packages bucket as default if no separate bucket is configured
    this.paymentsBucket = this.configService.get<string>(
      'AWS_PAYMENTS_BUCKET_NAME',
      this.packagesBucket,
    );
  }

  /**
   * Get bucket name based on bucket type
   */
  private getBucketByType(bucketType: BucketType): string {
    switch (bucketType) {
      case BucketType.PACKAGES:
        return this.packagesBucket;
      case BucketType.USERS:
        return this.usersBucket;
      case BucketType.LOGS:
        return this.logsBucket;
      case BucketType.PAYMENTS:
        return this.paymentsBucket;
      default:
        throw new BadRequestException(
          `Invalid bucket type: ${bucketType as string}`,
        );
    }
  }

  /**
   * Upload a file for packages
   */
  async uploadPackageFile(
    dto: UploadPackageDto,
    buffer: Buffer,
    contentType: string,
  ): Promise<S3UploadResult> {
    const bucket = this.packagesBucket;
    const key = this.generatePackageKey(dto.folder, dto.fileName || 'file');
    return this.s3Service.uploadFileWithBucket(
      bucket,
      key,
      buffer,
      contentType,
    );
  }

  /**
   * Upload a file for users
   */
  async uploadUserFile(
    dto: UploadUserDto,
    buffer: Buffer,
    contentType: string,
  ): Promise<S3UploadResult> {
    const bucket = dto.bucketType
      ? this.getBucketByType(dto.bucketType)
      : this.usersBucket;
    const key = this.generateUserKey(
      dto.folder,
      dto.userId,
      dto.fileName || 'file',
    );
    return this.s3Service.uploadFileWithBucket(
      bucket,
      key,
      buffer,
      contentType,
    );
  }

  /**
   * Upload a file for logs
   */
  async uploadLogFile(
    dto: UploadLogDto,
    buffer: Buffer,
    contentType: string,
  ): Promise<S3UploadResult> {
    const bucket = dto.bucketType
      ? this.getBucketByType(dto.bucketType)
      : this.logsBucket;
    const key = this.generateLogKey(dto.folder, dto.fileName || 'file');
    return this.s3Service.uploadFileWithBucket(
      bucket,
      key,
      buffer,
      contentType,
    );
  }

  /**
   * Generate key for package uploads
   * Structure: folder/timestamp_random.extension
   */
  private generatePackageKey(folder: string, fileName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop() || 'bin';
    const fileNameUnique = `${timestamp}_${random}.${extension}`;
    return `${folder}/${fileNameUnique}`;
  }

  /**
   * Generate key for user uploads
   * Structure: folder/userId/timestamp_random.extension or folder/timestamp_random.ext for general
   */
  private generateUserKey(
    folder: string,
    userId: string,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop() || 'bin';
    const fileNameUnique = `${timestamp}_${random}.${extension}`;
    return `${folder}/${userId}/${fileNameUnique}`;
  }

  /**
   * Generate key for log uploads
   * Structure: folder/timestamp_random.extension
   */
  private generateLogKey(folder: string, fileName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop() || 'log';
    const fileNameUnique = `${timestamp}_${random}.${extension}`;
    return `${folder}/${fileNameUnique}`;
  }

  /**
   * Upload a file for payments (CR-01)
   * Supports PDF, JPG, PNG files up to 5MB
   */
  async uploadPaymentFile(
    dto: UploadPaymentDto,
    buffer: Buffer,
    contentType: string,
  ): Promise<S3UploadResult> {
    this.logger.log(
      `Starting payment file upload: folder=${dto.folder}, fileName=${dto.fileName}, size=${buffer.length} bytes`,
    );

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (buffer.length > maxSize) {
      throw new BadRequestException(
        'File size exceeds 5MB limit for payment reference documents',
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      throw new BadRequestException(
        'Only PDF, JPG, and PNG files are allowed for payment reference documents',
      );
    }

    const bucket = dto.bucketType
      ? this.getBucketByType(dto.bucketType)
      : this.packagesBucket; // Use packages bucket as default for payments

    this.logger.log(`Using bucket: ${bucket} for payment document upload`);

    const key = this.generatePaymentKey(dto.folder, dto.fileName || 'document');

    this.logger.log(`Generated S3 key: ${key}`);

    return this.s3Service.uploadFileWithBucket(
      bucket,
      key,
      buffer,
      contentType,
    );
  }

  /**
   * Generate key for payment uploads (CR-01)
   * Structure: folder/uuid/timestamp_random.extension
   */
  private generatePaymentKey(folder: string, fileName: string): string {
    const uuid = randomUUID();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop() || 'bin';
    const fileNameUnique = `${timestamp}_${random}.${extension}`;
    return `${folder}/${uuid}/${fileNameUnique}`;
  }

  /**
   * Upload a file for generic purposes (e.g. chat media)
   */
  async uploadGenericFile(
    dto: UploadGenericDto,
    buffer: Buffer,
    contentType: string,
  ): Promise<S3UploadResult> {
    const bucket = dto.bucketType
      ? this.getBucketByType(dto.bucketType)
      : this.packagesBucket;
    const key = this.generateGenericKey(dto.folder, dto.fileName || 'file');
    return this.s3Service.uploadFileWithBucket(
      bucket,
      key,
      buffer,
      contentType,
    );
  }

  /**
   * Generate key for generic uploads
   * Structure: folder/uuid/timestamp_random.extension
   */
  private generateGenericKey(folder: string, fileName: string): string {
    const uuid = randomUUID();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop() || 'bin';
    const fileNameUnique = `${timestamp}_${random}.${extension}`;
    return `${folder}/${uuid}/${fileNameUnique}`;
  }

  /**
   * Test method: Upload directly to S3 without any validation
   * For testing S3 upload functionality only
   */
  async testUploadFile(
    buffer: Buffer,
    fileName: string,
    bucketType?: BucketType,
  ): Promise<S3UploadResult> {
    const bucket = bucketType
      ? this.getBucketByType(bucketType)
      : this.packagesBucket;
    const key = `test/${fileName}`;
    console.log(`Testing S3 upload to bucket: ${bucket}, key: ${key}`);
    return this.s3Service.uploadFileWithBucket(
      bucket,
      key,
      buffer,
      'text/plain',
    );
  }
}
