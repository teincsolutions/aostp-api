import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BucketType } from './index';

export enum UserFolder {
  GENERAL = 'general',
  AVATAR = 'avatar',
}

export class UploadUserDto {
  @ApiPropertyOptional({
    enum: BucketType,
    description: 'Type of bucket to upload to',
    example: BucketType.USERS,
  })
  @IsEnum(BucketType)
  bucketType?: BucketType;

  @ApiPropertyOptional({
    type: String,
    description: 'Original file name',
    example: 'user-avatar.png',
  })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({
    enum: UserFolder,
    description: 'Folder to upload the file to',
    example: UserFolder.AVATAR,
  })
  @IsEnum(UserFolder)
  folder: UserFolder;

  @ApiProperty({
    type: String,
    description: 'UUID of the user',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;
}
