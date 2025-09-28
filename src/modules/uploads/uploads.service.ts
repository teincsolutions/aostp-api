import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service, S3UploadResult } from '../../providers/storage/s3.service';
import {
  UploadPackageDto,
  UploadUserDto,
  UploadLogDto,
} from './dto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly packagesBucket: string;
  private readonly usersBucket: string;
  private readonly logsBucket: string;

  constructor(
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) {
    this.packagesBucket = this.configService.getOrThrow<string>('AWS_PACKAGES_BUCKET_NAME');
    this.usersBucket = this.configService.getOrThrow<string>('AWS_USERS_BUCKET_NAME');
    this.logsBucket = this.configService.getOrThrow<string>('AWS_LOGS_BUCKET_NAME');
  }

  /**
   * Upload a file for packages
   */
  async uploadPackageFile(
    dto: UploadPackageDto,
    buffer: Buffer,
    contentType: string,
  ): Promise<S3UploadResult> {
    const key = this.generatePackageKey(dto.folder, dto.packageId, dto.fileName || 'file');
    return this.s3Service.uploadFileWithBucket(
      this.packagesBucket,
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
    const key = this.generateUserKey(dto.folder, dto.userId, dto.fileName || 'file');
    return this.s3Service.uploadFileWithBucket(
      this.usersBucket,
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
    const key = this.generateLogKey(dto.folder, dto.fileName || 'file');
    return this.s3Service.uploadFileWithBucket(
      this.logsBucket,
      key,
      buffer,
      contentType,
    );
  }

  /**
   * Generate key for package uploads
   * Structure: folder/packageId/timestamp_random.extension
   */
  private generatePackageKey(folder: string, packageId: string, fileName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop() || 'bin';
    const fileNameUnique = `${timestamp}_${random}.${extension}`;
    return `${folder}/${packageId}/${fileNameUnique}`;
  }

  /**
   * Generate key for user uploads
   * Structure: folder/userId/timestamp_random.extension or folder/timestamp_random.ext for general
   */
  private generateUserKey(folder: string, userId: string, fileName: string): string {
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
}
