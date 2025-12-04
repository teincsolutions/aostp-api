import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContainerStatus } from '@prisma/client';

export class UpdateContainerStatusDto {
  @ApiProperty({
    description: 'New container status',
    enum: ContainerStatus,
    example: ContainerStatus.LOADED,
  })
  @IsEnum(ContainerStatus)
  @IsNotEmpty()
  status: ContainerStatus;
}
