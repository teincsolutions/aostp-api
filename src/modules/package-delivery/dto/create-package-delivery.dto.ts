import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  Min,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePackageDeliveryDto {
  @ApiProperty({
    description:
      'Invoice IDs where the deliveries belong (can be multiple invoices for the same customer)',
    example: ['60f1b2b5c1d9e2f4e6b4f1a2', '60f1b2b5c1d9e2f4e6b4f1a3'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  invoiceIds: string[];

  @ApiProperty({
    description:
      'Package tracking codes (optional). If not provided, all packages from the invoices will be picked up. If provided, only specified packages will be picked up.',
    example: ['TR-2025-001', 'TR-2025-002'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  trackingCodes?: string[];

  @ApiProperty({
    description: 'Receiver name (optional)',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiProperty({
    description: 'Quantity being picked up',
    example: 5,
    required: true,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Optional delivery notes',
    example: 'Delivered to front gate',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Delivery photos (URLs)',
    example: ['https://example.com/photo1.jpg'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
