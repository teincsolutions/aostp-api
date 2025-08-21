import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IdType, NotificationChannel } from '@prisma/client';
import { IsValidIdNumber } from '../../../shared/decorators/id-validation.decorator';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer first name',
    example: 'John',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({
    description: 'Customer last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({
    description: 'Customer email address',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Primary phone number',
    example: '+233501234567',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiPropertyOptional({
    description: 'Alternative phone number',
    example: '+233241234567',
  })
  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @ApiPropertyOptional({
    description: 'Customer address',
    example: '123 Main Street, Accra',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Accra',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  city?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'Ghana',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  country?: string;

  @ApiPropertyOptional({
    description: 'Type of ID document',
    enum: IdType,
    example: IdType.NATIONAL_ID,
  })
  @IsEnum(IdType)
  @IsOptional()
  idType?: IdType;

  @ApiPropertyOptional({
    description: 'ID document number',
    example: 'GHA-123456789-0',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @IsValidIdNumber()
  idNumber?: string;

  @ApiPropertyOptional({
    description: 'Preferred communication channel',
    enum: NotificationChannel,
    example: NotificationChannel.SMS,
  })
  @IsEnum(NotificationChannel)
  @IsOptional()
  preferredChannel?: NotificationChannel;
}
