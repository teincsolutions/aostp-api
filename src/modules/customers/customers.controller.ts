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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
  )
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('city') city?: string,
    @Query('country') country?: string,
  ) {
    const filters = {
      search,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      city,
      country,
    };
    return this.customersService.findAll(paginationDto, filters);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
  )
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Get('code/:customerCode')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
  )
  findByCode(@Param('customerCode') customerCode: string) {
    return this.customersService.findByCode(customerCode);
  }

  @Get('phone/:phoneNumber')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.OPERATIONS_CLERK,
    UserRole.PAYMENT_CLERK,
  )
  findByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.customersService.findByPhone(phoneNumber);
  }

  @Get(':id/stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  getCustomerStats(@Param('id') id: string) {
    return this.customersService.getCustomerStats(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OPERATIONS_CLERK)
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
