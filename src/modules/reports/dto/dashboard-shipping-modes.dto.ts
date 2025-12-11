import { ApiProperty } from '@nestjs/swagger';

export class ShippingModesResponseDto {
  @ApiProperty({ description: 'Count of AIR shipments', example: 1001 })
  air: number;

  @ApiProperty({ description: 'Count of SEA shipments', example: 588 })
  sea: number;
}
