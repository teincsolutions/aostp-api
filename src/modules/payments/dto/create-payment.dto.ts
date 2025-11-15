import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Custom validator for Direct Momo Transfer reference requirement
function IsReferenceRequired(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isReferenceRequired',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          // If payment method is DIRECT_MOMO_TRANSFER, reference is required
          if (obj.paymentMethod === 'DIRECT_MOMO_TRANSFER') {
            return value !== undefined && value !== null && value !== '';
          }
          return true; // Allow optional for other methods
        },
        defaultMessage(args: ValidationArguments) {
          return 'Reference is required for Direct Momo Transfer payments';
        },
      },
    });
  };
}

export class CreatePaymentDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Payment amount', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Currency code', default: 'USD' })
  @IsString()
  currency: string = 'USD';

  @ApiProperty({ description: 'Exchange rate ID to use for conversion' })
  @IsUUID()
  exchangeRateId: string;

  @ApiProperty({
    description: 'Payment method',
    examples: [
      'CASH',
      'BANK_TRANSFER',
      'MOBILE_MONEY',
      'CREDIT_CARD',
      'DIRECT_MOMO_TRANSFER',
    ],
  })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ description: 'Transaction reference number' })
  @ValidateIf((object) => object.paymentMethod === 'DIRECT_MOMO_TRANSFER')
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Invoice IDs to apply payment to',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  invoiceIds?: string[];

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
