import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { UpdateContainerStatusDto } from './dto/update-container-status.dto';
import { ContainerFilterDto } from './dto/container-filter.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, ContainerStatus } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('containers')
@ApiBearerAuth()
@Controller('containers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContainersController {
  constructor(private readonly containersService: ContainersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Create a new container' })
  @ApiResponse({ status: 201, description: 'Container created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createContainerDto: CreateContainerDto, @Request() req) {
    return this.containersService.create(createContainerDto, req.user.id);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({ summary: 'Get all containers with pagination and filters' })
  findAll(@Query() filterDto: ContainerFilterDto) {
    const { status, departureCity, destinationCity, search, ...paginationDto } =
      filterDto;
    return this.containersService.findAll(paginationDto, {
      status,
      departureCity,
      destinationCity,
      search,
    });
  }

  @Get('active')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({ summary: 'Get all active containers' })
  getActiveContainers() {
    return this.containersService.getActiveContainers();
  }

  @Get('date-range')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Get containers by date range' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    example: '2024-12-31',
  })
  getContainersByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.containersService.getContainersByDateRange(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('number/:containerNumber')
  @ApiOperation({ summary: 'Get container by container number' })
  @ApiParam({ name: 'containerNumber', description: 'Container number' })
  findByContainerNumber(@Param('containerNumber') containerNumber: string) {
    return this.containersService.findByContainerNumber(containerNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get container by ID' })
  @ApiParam({ name: 'id', description: 'Container ID' })
  findOne(@Param('id') id: string) {
    return this.containersService.findOne(id);
  }

  @Get(':id/statistics')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.FINANCE_MANAGER,
  )
  @ApiOperation({ summary: 'Get container statistics' })
  @ApiParam({ name: 'id', description: 'Container ID' })
  getContainerStatistics(@Param('id') id: string) {
    return this.containersService.getContainerStatistics(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Update container' })
  @ApiParam({ name: 'id', description: 'Container ID' })
  update(
    @Param('id') id: string,
    @Body() updateContainerDto: UpdateContainerDto,
    @Request() req,
  ) {
    return this.containersService.update(id, updateContainerDto, req.user.id);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  @ApiOperation({ summary: 'Update container status' })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({
    status: 200,
    description: 'Container status updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateContainerStatusDto,
    @Request() req,
  ) {
    return this.containersService.updateStatus(
      id,
      updateStatusDto.status,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete container' })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.containersService.remove(id, req.user.id);
  }
}
