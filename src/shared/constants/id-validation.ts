/**
 * ID Validation Patterns and Constants
 */

export const ID_VALIDATION_PATTERNS = {
  ghanaCard: /^[A-Z]{3}-\d{9}-\d$/,
  passport: /^[A-Z]\d{7}$/,
  driversLicense: /^[A-Z]{1,2}\d{6,7}$/,
  voterId: /^[A-Z0-9]{10,12}$/,
} as const;

export const ID_TYPE_MAPPING = {
  NATIONAL_ID: 'ghanaCard',
  PASSPORT: 'passport',
  DRIVERS_LICENSE: 'driversLicense',
  VOTER_ID: 'voterId',
} as const;

export const ID_FORMAT_DESCRIPTIONS = {
  ghanaCard: 'Ghana Card format: ABC-123456789-0',
  passport: 'Passport format: A1234567',
  driversLicense: "Driver's License format: A123456 or AB1234567",
  voterId: 'Voter ID format: 10-12 alphanumeric characters',
} as const;

export type IdValidationKey = keyof typeof ID_VALIDATION_PATTERNS;
export type IdTypeKey = keyof typeof ID_TYPE_MAPPING;
