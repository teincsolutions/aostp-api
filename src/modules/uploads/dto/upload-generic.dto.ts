import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BucketType } from './index';

export class UploadGenericDto {
  @ApiPropertyOptional({
    enum: BucketType,
    description: 'Type of bucket to upload to',
    default: BucketType.PACKAGES,
  })
  @IsEnum(BucketType)
  @IsOptional()
  bucketType?: BucketType = BucketType.PACKAGES;

  @ApiProperty({
    type: String,
    description: 'Folder to upload the file to (e.g. chat-media)',
  })
  @IsString()
  folder: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Original file name',
  })
  @IsString()
  @IsOptional()
  fileName?: string;
}
