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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { CityFilterDto } from './dto/city-filter.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('cities')
@ApiBearerAuth()
@Controller('cities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new city',
    description: 'Create a new city record',
  })
  @ApiBody({ type: CreateCityDto })
  @ApiResponse({
    status: 201,
    description: 'City created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - city already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createCityDto: CreateCityDto) {
    return this.citiesService.create(createCityDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PAYMENT_CLERK)
  @ApiOperation({
    summary: 'Get all cities with pagination',
    description: 'Retrieve a paginated list of cities with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Cities retrieved successfully',
  })
  @ApiQuery({ type: CityFilterDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query() filterDto: CityFilterDto) {
    const { search, country, ...paginationDto } = filterDto;
    const filters = { search, country };
    return this.citiesService.findAll(paginationDto, filters);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PAYMENT_CLERK)
  @ApiOperation({
    summary: 'Get city by ID',
    description: 'Retrieve a single city by its unique identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'City found',
  })
  @ApiResponse({ status: 404, description: 'City not found' })
  findOne(@Param('id') id: string) {
    return this.citiesService.findOne(id);
  }

  @Get('country/:country')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PAYMENT_CLERK)
  @ApiOperation({
    summary: 'Get cities by country',
    description: 'Retrieve all cities for a specific country',
  })
  @ApiResponse({
    status: 200,
    description: 'Cities retrieved successfully',
  })
  findByCountry(@Param('country') country: string) {
    return this.citiesService.findByCountry(country);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update city',
    description: 'Update city information',
  })
  @ApiBody({ type: UpdateCityDto })
  @ApiResponse({ status: 200, description: 'City updated successfully' })
  @ApiResponse({ status: 404, description: 'City not found' })
  @ApiResponse({ status: 409, description: 'Conflict - city already exists' })
  update(@Param('id') id: string, @Body() updateCityDto: UpdateCityDto) {
    return this.citiesService.update(id, updateCityDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete city',
    description: 'Delete a city record (only if no shipping rates exist)',
  })
  @ApiResponse({ status: 200, description: 'City deleted successfully' })
  @ApiResponse({ status: 404, description: 'City not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - cannot delete city with shipping rates',
  })
  remove(@Param('id') id: string) {
    return this.citiesService.remove(id);
  }
}
