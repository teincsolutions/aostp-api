import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPackagesToPackingListDto {
  @ApiProperty({
    description: 'Array of package IDs to add to the packing list',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '456e7890-e89b-12d3-a456-426614174001',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(4, { each: true })
  packageIds: string[];
}
