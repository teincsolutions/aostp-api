import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum LogFolder {
  SYSTEM = 'system',
  ACCESS = 'access',
  ERROR = 'error',
}

export class UploadLogDto {
  @IsString()
  @IsOptional()
  fileName?: string;

  @IsEnum(LogFolder)
  folder: LogFolder;
}
