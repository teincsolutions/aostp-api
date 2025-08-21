import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsPhoneNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { IdType, NotificationChannel } from '@prisma/client';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  country?: string;

  @IsEnum(IdType)
  @IsOptional()
  idType?: IdType;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  idNumber?: string;

  @IsEnum(NotificationChannel)
  @IsOptional()
  preferredChannel?: NotificationChannel;
}
