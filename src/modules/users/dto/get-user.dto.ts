import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

export class GetUserDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search term',
    example: 'nestjs',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Is the user active?',
    example: true,
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'User role',
    example: 'SUPER_ADMIN',
  })
  @IsString()
  @IsOptional()
  role?: UserRole | null;
}
