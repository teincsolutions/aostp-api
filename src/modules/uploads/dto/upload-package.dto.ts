import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BucketType } from './index';

export enum PackageFolder {
  PICTURES = 'pictures',
  VIDEOS = 'videos',
}

export class UploadPackageDto {
  @ApiPropertyOptional({
    enum: BucketType,
    description: 'Type of bucket to upload to',
    example: BucketType.PACKAGES,
  })
  @ApiPropertyOptional({
    type: String,
    description: 'Original file name',
    example: 'package-image.jpg',
  })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({
    enum: PackageFolder,
    description: 'Folder to upload the file to',
    example: PackageFolder.PICTURES,
  })
  @IsEnum(PackageFolder)
  folder: PackageFolder;
}
