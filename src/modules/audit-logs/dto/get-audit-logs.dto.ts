import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { AuditAction, AuditEntity } from '../audit-log.types';

export class GetAuditLogsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: AuditAction,
    example: 'CREATE',
  })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: AuditEntity,
    example: 'User',
  })
  @IsOptional()
  @IsEnum(AuditEntity)
  entity?: AuditEntity;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by IP address',
    example: '192.168.1.1',
  })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({
    description:
      'Search in action, entity, entity ID, IP address, and user (email, username, name)',
    example: 'CREATE',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation timestamp from date (ISO 8601 format)',
    example: '2023-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation timestamp to date (ISO 8601 format)',
    example: '2023-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
