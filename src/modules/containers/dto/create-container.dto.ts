import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContainerStatus, ContainerType } from '@prisma/client';

export class CreateContainerDto {
  @ApiProperty({ description: 'Container number (unique identifier)' })
  @IsString()
  @IsNotEmpty()
  containerNumber: string;

  @ApiProperty({
    description: 'Container type (for air/sea filtering)',
    enum: ContainerType,
    example: ContainerType.CONTAINER,
  })
  @IsEnum(ContainerType)
  containerType: ContainerType;

  @ApiProperty({ description: 'Loading date', example: '2024-01-15T00:00:00Z' })
  @IsDateString()
  loadingDate: string;

  @ApiProperty({
    description: 'Departure city ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  departureCityId: string;

  @ApiProperty({
    description: 'Destination city ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  destinationCityId: string;

  @ApiProperty({
    description: 'Estimated time of arrival (ETA)',
    example: '2024-02-25T00:00:00Z',
  })
  @IsDateString()
  eta: string;

  @ApiPropertyOptional({
    enum: ContainerStatus,
    description: 'Initial container status',
    default: ContainerStatus.PLANNED,
  })
  @IsOptional()
  @IsEnum(ContainerStatus)
  status?: ContainerStatus = ContainerStatus.PLANNED;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
