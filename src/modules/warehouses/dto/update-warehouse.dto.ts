import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  location?: string;

  @IsOptional()
  @IsString()
  contactInfo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
