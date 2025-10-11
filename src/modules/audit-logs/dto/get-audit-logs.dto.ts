import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { AuditAction, AuditEntityType } from '../audit-log.types';

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
    enum: AuditEntityType,
    example: 'User',
  })
  @IsOptional()
  @IsEnum(AuditEntityType)
  entity?: AuditEntityType;

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
}
