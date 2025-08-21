# ID Validation and Uniqueness Implementation

## Overview
This implementation adds comprehensive ID validation and uniqueness constraints for customer ID cards in the AOSTP system.

## Features Implemented

### 1. ID Format Validation
- **Ghana Card (National ID)**: `GHA-123456789-0` format
- **Passport**: `A1234567` format  
- **Driver's License**: `A123456` or `AB1234567` format
- **Voter ID**: `ABC123DEF456` (10-12 alphanumeric characters)

### 2. Database Schema Updates
- Added `VOTER_ID` to the `IdType` enum
- Added unique constraint on `(idType, idNumber)` combination
- Added index on `idNumber` field for performance

### 3. Validation Implementation

#### Files Created/Modified:

**`src/shared/constants/id-validation.ts`**
- Defines regex patterns for each ID type
- Maps Prisma enum values to validation patterns
- Provides user-friendly format descriptions

**`src/shared/decorators/id-validation.decorator.ts`**
- Custom class-validator decorator `@IsValidIdNumber()`
- Validates ID format based on the selected ID type
- Provides contextual error messages

**`src/modules/customers/dto/create-customer.dto.ts`**
- Added `@IsValidIdNumber()` decorator to `idNumber` field
- Validates format when both `idType` and `idNumber` are provided

**`src/modules/customers/customers.service.ts`**
- Added uniqueness validation in `create()` method
- Added uniqueness validation in `update()` method
- Prevents duplicate ID numbers for the same ID type
- Allows same ID number for different ID types

### 4. Validation Rules

#### Format Validation
```typescript
const ID_VALIDATION_PATTERNS = {
  ghanaCard: /^[A-Z]{3}-\d{9}-\d$/,        // GHA-123456789-0
  passport: /^[A-Z]\d{7}$/,                // A1234567
  driversLicense: /^[A-Z]{1,2}\d{6,7}$/,   // A123456 or AB1234567
  voterId: /^[A-Z0-9]{10,12}$/,            // ABC123DEF456
}
```

#### Uniqueness Rules
- Each ID number must be unique within its ID type
- Same ID number can exist for different ID types
- Customers can exist without ID information
- ID type `OTHER` skips format validation

### 5. Database Migration
- Migration `20250821145312_add_voter_id_and_unique_id_constraint` applied
- Database reset and reseeded successfully
- Unique constraint `Customer_idType_idNumber_key` created

### 6. Error Handling
- **Format Validation**: Returns specific error message with expected format
- **Uniqueness Validation**: Throws `ConflictException` with descriptive message
- **Graceful Handling**: Allows optional ID fields and `OTHER` type

## Usage Examples

### Valid ID Formats
```typescript
// Ghana Card
{ idType: 'NATIONAL_ID', idNumber: 'GHA-123456789-0' }

// Passport
{ idType: 'PASSPORT', idNumber: 'A1234567' }

// Driver's License
{ idType: 'DRIVERS_LICENSE', idNumber: 'AB1234567' }

// Voter ID
{ idType: 'VOTER_ID', idNumber: 'ABC123DEF456' }

// Other (no validation)
{ idType: 'OTHER', idNumber: 'ANY-FORMAT-123' }

// No ID (allowed)
{ idType: null, idNumber: null }
```

### Error Responses
```typescript
// Invalid format
{
  "statusCode": 400,
  "message": [
    "Invalid national id format. Expected: Ghana Card format: ABC-123456789-0"
  ],
  "error": "Bad Request"
}

// Duplicate ID
{
  "statusCode": 409,
  "message": "Customer with this national id already exists",
  "error": "Conflict"
}
```

## Testing
The implementation includes comprehensive validation that ensures:
1. ✅ ID format validation works for all supported types
2. ✅ Uniqueness constraints prevent duplicate IDs
3. ✅ Different ID types can have same number format
4. ✅ Customers without ID information are allowed
5. ✅ Database migration applied successfully
6. ✅ Seed data works with new constraints

## Benefits
- **Data Integrity**: Prevents invalid and duplicate ID numbers
- **User Experience**: Clear error messages guide users
- **Flexibility**: Supports multiple ID types with appropriate validation
- **Performance**: Database indexes optimize ID lookups
- **Maintainability**: Centralized validation logic and constants
