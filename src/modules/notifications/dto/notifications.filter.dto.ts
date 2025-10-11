import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { NotificationChannel } from '@prisma/client';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class GetNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by notification channel',
    enum: NotificationChannel,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Filter by notification status',
    example: 'FAILED',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO string)',
    example: '2023-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO string)',
    example: '2023-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer ID',
    example: 'customer-uuid',
  })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by recipient',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional({
    description: 'Search in content or subject',
    example: 'package received',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
