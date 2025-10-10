import { IsString, IsOptional, IsInt, IsArray, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePackageDeliveryDto {
  @ApiProperty({
    description: 'Invoice ID where the delivery belongs',
    example: '60f1b2b5c1d9e2f4e6b4f1a2',
  })
  @IsString()
  @IsNotEmpty()
  invoiceId: string;

  @ApiProperty({
    description: 'Package item intake tracking code',
    example: 'PKG2025001001',
  })
  @IsString()
  @IsNotEmpty()
  packageItemIntakeTrackingCode: string;

  @ApiProperty({
    description: 'Receiver name (optional)',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiProperty({
    description: 'Quantity released (optional, defaults to full quantity)',
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

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
