import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateContainerDto } from './create-container.dto';
import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContainerStatus } from '@prisma/client';

export class UpdateContainerDto extends PartialType(
  OmitType(CreateContainerDto, ['containerNumber'] as const),
) {
  @ApiPropertyOptional({
    enum: ContainerStatus,
    description: 'Container status',
  })
  @IsOptional()
  @IsEnum(ContainerStatus)
  status?: ContainerStatus;

  @ApiPropertyOptional({
    description: 'Actual arrival date',
    example: '2024-02-26T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  actualArrival?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
