import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  name: string; // e.g., "China Main"

  @IsString()
  @IsNotEmpty()
  location: string; // Address

  @IsOptional()
  @IsString()
  contactInfo?: string; // phone/email

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
