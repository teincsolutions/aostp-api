import { IsOptional, IsString, IsEnum } from 'class-validator';
import { BucketType } from './index';

export enum LogFolder {
  SYSTEM = 'system',
  ACCESS = 'access',
  ERROR = 'error',
}

export class UploadLogDto {
  @IsEnum(BucketType)
  bucketType?: BucketType;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsEnum(LogFolder)
  folder: LogFolder;
}
