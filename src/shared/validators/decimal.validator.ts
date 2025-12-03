import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Decorator to validate that a number has at most 2 decimal places
 * This is crucial for financial calculations to avoid floating point precision issues
 *
 * @param validationOptions - Optional validation options
 *
 * @example
 * class PaymentDto {
 *   @IsDecimalPlaces(2)
 *   amount: number;
 * }
 */
export function IsDecimalPlaces(
  decimalPlaces: number = 2,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDecimalPlaces',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [decimalPlaces],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (value === null || value === undefined) {
            return true; // Let other decorators handle null/undefined
          }

          if (typeof value !== 'number') {
            return false;
          }

          const maxDecimalPlaces = args.constraints[0];
          const decimalPart = value.toString().split('.')[1];

          if (!decimalPart) {
            return true; // No decimal places is valid
          }

          return decimalPart.length <= maxDecimalPlaces;
        },
        defaultMessage(args: ValidationArguments) {
          const maxDecimalPlaces = args.constraints[0];
          return `${args.property} must have at most ${maxDecimalPlaces} decimal places`;
        },
      },
    });
  };
}
