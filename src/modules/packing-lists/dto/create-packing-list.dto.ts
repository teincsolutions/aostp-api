import { IsString, IsUUID, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePackingListDto {
  @ApiPropertyOptional({
    description:
      'Unique name for the packing list (defaults to loading date if not provided)',
    example: 'PL-2024-01-15-ACCRA',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Container ID that this packing list belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  containerId: string;

  @ApiPropertyOptional({
    description: 'Warehouse ID for the packing list',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiProperty({
    description: 'Loading date for the container',
    example: '2024-01-15T08:00:00.000Z',
  })
  @IsDateString()
  loadingDate: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the packing list',
    example: 'Special handling required for fragile items',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
