import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ConsolidationService } from './consolidation.service';
import { ConsolidatePackagesDto } from './dto/consolidate-packages.dto';
import { Roles } from '../../shared/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('consolidation')
@Controller('consolidation')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConsolidationController {
  constructor(private readonly consolidationService: ConsolidationService) {}

  @Post('consolidate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Consolidate multiple packages into one parent package',
    description:
      'Combines 2+ packages from the same customer and shipping mode into a single consolidated parent package. All source packages must be in RECEIVED status and not already consolidated. If targetTrackingCode is not provided, it will be auto-generated.',
  })
  @ApiBody({
    type: ConsolidatePackagesDto,
    description:
      'Source tracking codes and optional target tracking code for consolidation',
  })
  @ApiResponse({
    status: 201,
    description: 'Packages consolidated successfully',
    schema: {
      type: 'object',
      properties: {
        parentPackage: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid' },
            trackingCode: { type: 'string', example: 'AOSTP-123456789-001' },
            totalWeight: { type: 'number', example: 25.5 },
            totalCBM: { type: 'number', example: 0.5 },
            totalQuantity: { type: 'number', example: 8 },
            itemCount: { type: 'number', example: 3 },
          },
        },
        consolidatedPackages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              trackingCode: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or consolidation not allowed',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (requires OPERATIONS_CLERK role)',
  })
  async consolidatePackages(
    @Body() consolidatePackagesDto: ConsolidatePackagesDto,
    @Request() req: any,
  ) {
    const { sourceTrackingCodes, targetTrackingCode } = consolidatePackagesDto;
    return this.consolidationService.consolidatePackages(
      sourceTrackingCodes,
      targetTrackingCode,
      req.user.id,
    );
  }

  @Get('packages-for-consolidation')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({
    summary: 'Get eligible packages for consolidation',
    description:
      'Retrieves all packages for a customer that can be consolidated together (same shipping mode, not already consolidated, in RECEIVED status)',
  })
  @ApiQuery({
    name: 'customerId',
    required: true,
    description: 'Customer UUID to filter packages',
    example: 'uuid-customer-123',
  })
  @ApiQuery({
    name: 'shippingMode',
    required: false,
    enum: ['SEA', 'AIR'],
    description: 'Optional shipping mode filter to narrow results',
    example: 'SEA',
  })
  @ApiResponse({
    status: 200,
    description: 'Packages retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          trackingCode: { type: 'string' },
          customerId: { type: 'string' },
          description: { type: 'string' },
          weight: { type: 'number' },
          cbm: { type: 'number' },
          quantity: { type: 'number' },
          shippingMode: { type: 'string', enum: ['SEA', 'AIR'] },
          status: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                description: { type: 'string' },
                weight: { type: 'number' },
                cbm: { type: 'number' },
                quantity: { type: 'number' },
              },
            },
          },
          _count: {
            type: 'object',
            properties: {
              items: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid customer ID or shipping mode',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized access' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions (requires OPERATIONS_CLERK role)',
  })
  async getPackagesForConsolidation(
    @Query('customerId') customerId: string,
    @Query('shippingMode') shippingMode: string,
  ) {
    return this.consolidationService.getPackagesForConsolidation(
      customerId,
      shippingMode as any,
    );
  }
}
