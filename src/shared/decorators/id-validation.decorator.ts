import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { IdType } from '@prisma/client';
import {
  ID_VALIDATION_PATTERNS,
  ID_TYPE_MAPPING,
  ID_FORMAT_DESCRIPTIONS,
} from '../constants/id-validation';

@ValidatorConstraint({ async: false })
export class IsValidIdNumberConstraint implements ValidatorConstraintInterface {
  validate(idNumber: string, args: ValidationArguments) {
    const object = args.object as any;
    const idType: IdType = object.idType;

    // If no ID type is provided, skip validation
    if (!idType || !idNumber) {
      return true;
    }

    // Skip validation for OTHER type
    if (idType === 'OTHER') {
      return true;
    }

    // Get the validation pattern for this ID type
    const patternKey = ID_TYPE_MAPPING[idType];
    if (!patternKey) {
      return false;
    }

    const pattern = ID_VALIDATION_PATTERNS[patternKey];
    return pattern.test(idNumber);
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const idType: IdType = object.idType;

    if (!idType || idType === 'OTHER') {
      return 'Invalid ID number format';
    }

    const patternKey = ID_TYPE_MAPPING[idType];
    if (!patternKey) {
      return 'Invalid ID type';
    }

    const description = ID_FORMAT_DESCRIPTIONS[patternKey];
    return `Invalid ${idType.toLowerCase().replace('_', ' ')} format. Expected: ${description}`;
  }
}

export function IsValidIdNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidIdNumberConstraint,
    });
  };
}
