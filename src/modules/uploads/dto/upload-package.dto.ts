import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';

export enum PackageFolder {
  PICTURES = 'pictures',
  VIDEOS = 'videos',
}

export class UploadPackageDto {
  @IsString()
  @IsOptional()
  fileName?: string;

  @IsEnum(PackageFolder)
  folder: PackageFolder;

  @IsUUID()
  packageId: string;
}
