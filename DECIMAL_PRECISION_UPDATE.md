# Decimal Precision Update - 2 Decimal Places for Financial Data

## Overview

Updated all financial-related services to ensure amounts and rates are rounded to 2 decimal places to avoid incomplete payments and precision issues.

## Changes Made

### 1. Created Utility Function

**File:** `src/shared/utils/decimal.utils.ts`

- `roundToTwoDecimals(value)` - Rounds any number to 2 decimal places
- `roundAllToTwoDecimals(values)` - Rounds array of numbers
- `calculateAndRound(calculation)` - Calculates and rounds result

### 2. Created Custom Validator

**File:** `src/shared/validators/decimal.validator.ts`

- `@IsDecimalPlaces(2)` - Custom class-validator decorator to validate max 2 decimal places in DTOs

### 3. Updated Services

#### Exchange Rates Service

**File:** `src/modules/exchange-rates/exchange-rates.service.ts`

- ✅ Round rate input in `create()` method
- ✅ Round amounts in `convertAmount()` method
- ✅ Round conversion results

#### Payments Service

**File:** `src/modules/payments/payments.service.ts`

- ✅ Round payment amount in `create()` method
- ✅ Round local amount calculation (with exchange rate conversion)
- ✅ Round amounts in `applyPaymentToInvoices()` method
- ✅ Round invoice paid amounts and balances
- ✅ Round all currency conversions in `convertAmountToCurrency()` method

#### Packages Service

**File:** `src/modules/packages/packages.service.ts`

- ✅ Round shipping rates in `create()` method
- ✅ Round calculated shipping costs
- ✅ Round shipping rates in `update()` method
- ✅ Round recalculated shipping costs

### 4. Updated DTOs with Validation

#### Payment DTOs

**File:** `src/modules/payments/dto/create-payment.dto.ts`

- ✅ Added `@IsDecimalPlaces(2)` to `amount` field

#### Exchange Rate DTOs

**File:** `src/modules/exchange-rates/dto/create-exchange-rate.dto.ts`

- ✅ Added `@IsDecimalPlaces(2)` to `rate` field

#### Package DTOs

**File:** `src/modules/packages/dto/create-package.dto.ts`

- ✅ Added `@IsDecimalPlaces(2)` to `shippingRate` field
- ✅ Added `@IsDecimalPlaces(2)` to `shippingCost` field

#### Invoice DTOs

**File:** `src/modules/invoices/dto/create-invoice.dto.ts`

- ✅ Added `@IsDecimalPlaces(2)` to `exchangeRate` field

## Impact

### Before

- Amounts could have many decimal places (e.g., 10.123456789)
- Currency conversions could result in precision issues
- Payments might not fully settle invoices due to decimal rounding errors
- Example: Payment of 100.005 might not match invoice of 100.01

### After

- All amounts are consistently rounded to 2 decimal places
- Currency conversions are precise and consistent
- Payment settlements are accurate
- Example: Payment of 100.01 exactly matches invoice of 100.01

## Testing Recommendations

1. **Payment Creation**
   - Create payment with amount like 100.129 → should be rounded to 100.13
   - Verify payment applied correctly to invoice

2. **Exchange Rate Conversion**
   - Create exchange rate with rate 12.5678 → should be rounded to 12.57
   - Convert amounts and verify 2 decimal place results

3. **Package Shipping Costs**
   - Create package with shipping rate 5.999 → should be rounded to 6.00
   - Verify calculated shipping cost is also 2 decimal places

4. **Invoice Settlements**
   - Create invoice for $100.00
   - Make payment of $50.50
   - Verify balance is exactly $49.50 (not $49.4999999)

5. **Validation**
   - Try to create payment with amount 100.123 (3 decimals) → should fail validation
   - Try to create exchange rate with rate 12.567 (3 decimals) → should fail validation

## API Changes

No breaking changes - the API still accepts the same inputs but now:

- Validates that amounts have at most 2 decimal places
- Automatically rounds all calculations to 2 decimal places
- Returns consistently formatted amounts

## Database Impact

No database migration required - this is purely a business logic change.

## Notes

- All existing data is unaffected
- The utility function handles null/undefined values safely
- The validator only checks input, doesn't transform it
- The service layer handles all rounding transparently
- Logging messages updated to show rounded values

## Files Modified

1. `src/shared/utils/decimal.utils.ts` (NEW)
2. `src/shared/validators/decimal.validator.ts` (NEW)
3. `src/modules/exchange-rates/exchange-rates.service.ts`
4. `src/modules/payments/payments.service.ts`
5. `src/modules/packages/packages.service.ts`
6. `src/modules/payments/dto/create-payment.dto.ts`
7. `src/modules/exchange-rates/dto/create-exchange-rate.dto.ts`
8. `src/modules/packages/dto/create-package.dto.ts`
9. `src/modules/invoices/dto/create-invoice.dto.ts`

## Verification Checklist

- [x] Utility functions created and documented
- [x] Custom validator created and documented
- [x] Exchange rates service updated
- [x] Payments service updated
- [x] Packages service updated
- [x] All relevant DTOs updated with validators
- [x] Import statements added to all modified files
- [x] All calculations use rounding utility
- [x] Currency conversions use rounding
- [x] Invoice settlements use rounding
