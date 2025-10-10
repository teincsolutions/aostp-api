import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPackagesToPackingListDto {
  @ApiProperty({
    description: 'Array of package IDs to add to the packing list',
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
    ],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one package ID is required' })
  @IsUUID('4', { each: true, message: 'Each package ID must be a valid UUID' })
  packageIds: string[];
}
