import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';

export enum UserFolder {
  GENERAL = 'general',
  AVATAR = 'avatar',
}

export class UploadUserDto {
  @IsString()
  @IsOptional()
  fileName?: string;

  @IsEnum(UserFolder)
  folder: UserFolder;

  @IsUUID()
  userId: string;
}
