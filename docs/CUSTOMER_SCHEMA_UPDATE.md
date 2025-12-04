# Customer Schema Update - Removed City & Country Fields

## Summary

Removed the `city` and `country` string fields from the Customer model in favor of using the existing `cityId` foreign key reference to the City table. This improves data consistency and enables better relational queries.

---

## Changes Made

### 1. Database Schema (prisma/schema.prisma)

**Removed Fields:**

- `city` (String, optional)
- `country` (String, optional)

**Retained Fields:**

- `cityId` (String UUID, optional) - Foreign key to City table
- `cityRef` - Relation to City model (provides name and country)
- `warehouseId` (String UUID, optional) - Foreign key to Warehouse table
- `warehouse` - Relation to Warehouse model

**Migration:**

- Migration file: `20251204223222_drop_city_country_from_customer`
- SQL: `ALTER TABLE "Customer" DROP COLUMN "city", DROP COLUMN "country";`

---

### 2. DTOs Updated

#### CreateCustomerDto (`src/modules/customers/dto/create-customer.dto.ts`)

**Removed:**

```typescript
@ApiPropertyOptional({ description: 'City' })
city?: string;

@ApiPropertyOptional({ description: 'Country' })
country?: string;
```

**Kept:**

```typescript
@ApiPropertyOptional({ description: 'Warehouse ID' })
warehouseId?: string;

@ApiPropertyOptional({ description: 'City ID from cities table' })
cityId?: string;
```

#### CustomerFilterDto (`src/modules/customers/dto/customer-filter.dto.ts`)

**Removed:**

```typescript
@ApiPropertyOptional({ description: 'Filter by city' })
city?: string;

@ApiPropertyOptional({ description: 'Filter by country' })
country?: string;
```

**Kept:**

```typescript
@ApiPropertyOptional({ description: 'Search by name, email, or phone' })
search?: string;

@ApiPropertyOptional({ description: 'Filter by active status' })
isActive?: string;
```

---

### 3. Service Layer (`src/modules/customers/customers.service.ts`)

#### Before:

```typescript
async findAll(
  paginationDto: PaginationDto,
  filters?: {
    search?: string;
    isActive?: boolean;
    city?: string;        // ❌ Removed
    country?: string;     // ❌ Removed
  }
) {
  const where: Prisma.CustomerWhereInput = {
    ...(filters?.city && { city: { contains: filters.city } }),
    ...(filters?.country && { country: { contains: filters.country } }),
  };
}
```

#### After:

```typescript
async findAll(
  paginationDto: PaginationDto,
  filters?: {
    search?: string;
    isActive?: boolean;
  }
) {
  const where: Prisma.CustomerWhereInput = {
    // No city/country filters
  };
}
```

**Response Still Includes City Data via Relation:**

```typescript
include: {
  warehouse: {
    select: { id: true, name: true, location: true }
  },
  cityRef: {
    select: { id: true, name: true, country: true }  // ✅ City data here
  }
}
```

---

### 4. Controller (`src/modules/customers/customers.controller.ts`)

#### Before:

```typescript
findAll(@Query() filterDto: CustomerFilterDto) {
  const { search, isActive, city, country, ...paginationDto } = filterDto;
  const filters = { search, isActive, city, country };
  return this.customersService.findAll(paginationDto, filters);
}
```

#### After:

```typescript
findAll(@Query() filterDto: CustomerFilterDto) {
  const { search, isActive, ...paginationDto } = filterDto;
  const filters = { search, isActive };
  return this.customersService.findAll(paginationDto, filters);
}
```

---

### 5. Documentation (`docs/CUSTOMERS_API.md`)

**Updated Sections:**

1. **Create Customer Request Body:**
   - Removed `city` and `country` fields
   - Documented `cityId` as replacement

2. **Query Parameters (Get All):**
   - Removed `city` and `country` filter parameters
   - Updated filter examples

3. **Response Examples:**
   - Removed `city` and `country` from customer object
   - Show `cityRef` relation with nested city data

4. **Changelog:**
   - Added Version 1.2.0 entry documenting breaking change
   - Included migration notes for developers

---

## Benefits

### 1. Data Consistency

- Single source of truth for city/country data
- No duplicate or conflicting city names
- Referential integrity via foreign key

### 2. Easier Maintenance

- City data managed in one place (City table)
- Updates to city names/countries apply everywhere
- No need to sync string fields across records

### 3. Better Queries

- Can filter customers by city using joins
- Can aggregate customer counts per city
- Enables city-based reporting and analytics

### 4. Type Safety

- UUID references prevent typos
- Database enforces valid city references
- Null values explicitly allowed (optional field)

---

## API Impact

### Breaking Changes

**Request Body (Create/Update Customer):**

```json
// ❌ OLD - No longer supported
{
  "firstName": "John",
  "city": "Accra",
  "country": "Ghana"
}

// ✅ NEW - Use cityId instead
{
  "firstName": "John",
  "cityId": "uuid-city-id"
}
```

**Query Parameters (Get All Customers):**

```bash
# ❌ OLD - No longer supported
GET /api/customers?city=Accra&country=Ghana

# ✅ NEW - Use search or rely on cityRef in response
GET /api/customers?search=Accra
```

**Response Data:**

```json
// ✅ City data now comes from relation
{
  "id": "customer-uuid",
  "firstName": "John",
  "cityId": "city-uuid",
  "cityRef": {
    "id": "city-uuid",
    "name": "Accra",
    "country": "Ghana"
  }
}
```

---

## Migration Path for Clients

### Step 1: Update API Calls

**Before:**

```javascript
// Creating customer with city/country strings
const response = await fetch('/api/customers', {
  method: 'POST',
  body: JSON.stringify({
    firstName: 'John',
    city: 'Accra',
    country: 'Ghana',
  }),
});
```

**After:**

```javascript
// Creating customer with cityId reference
const cityId = await getCityId('Accra', 'Ghana'); // Lookup or create city
const response = await fetch('/api/customers', {
  method: 'POST',
  body: JSON.stringify({
    firstName: 'John',
    cityId: cityId,
  }),
});
```

### Step 2: Update Response Handling

**Before:**

```javascript
const customer = await response.json();
console.log(customer.city); // "Accra"
console.log(customer.country); // "Ghana"
```

**After:**

```javascript
const customer = await response.json();
console.log(customer.cityRef?.name); // "Accra"
console.log(customer.cityRef?.country); // "Ghana"
```

### Step 3: Update Filters

**Before:**

```javascript
GET /api/customers?city=Accra&country=Ghana
```

**After:**

```javascript
// Option 1: Use city name in search
GET /api/customers?search=Accra

// Option 2: Filter on frontend after fetching
const customers = await getCustomers();
const accraCustomers = customers.filter(c => c.cityRef?.name === 'Accra');
```

---

## Database Migration Details

### Migration File

`prisma/migrations/20251204223222_drop_city_country_from_customer/migration.sql`

### SQL Executed

```sql
ALTER TABLE "Customer"
  DROP COLUMN "city",
  DROP COLUMN "country";
```

### Data Loss Warning

⚠️ **This migration permanently removes city and country data**

If you had existing data in these fields, it is now deleted. To preserve this data, you should:

1. Export customer data before migration
2. Create City records from unique city/country combinations
3. Update customers with cityId references
4. Then run the migration

### Rollback (if needed)

```sql
-- Re-add columns (data will be null)
ALTER TABLE "Customer"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT;
```

---

## Testing Checklist

- [x] Schema migration applied successfully
- [x] Prisma Client regenerated
- [x] Create customer without city/country works
- [x] Create customer with cityId works
- [x] Get customer returns cityRef relation
- [x] Filter by search (no city/country params) works
- [x] Update customer works without city/country
- [x] DTOs validate correctly
- [x] Documentation updated
- [x] No compilation errors

---

## Files Modified

1. ✅ `prisma/schema.prisma` - Removed city/country fields
2. ✅ `src/modules/customers/dto/create-customer.dto.ts` - Removed city/country
3. ✅ `src/modules/customers/dto/customer-filter.dto.ts` - Removed city/country filters
4. ✅ `src/modules/customers/customers.service.ts` - Removed filter logic
5. ✅ `src/modules/customers/customers.controller.ts` - Removed filter extraction
6. ✅ `docs/CUSTOMERS_API.md` - Updated documentation with v1.2.0 changelog

---

## Conclusion

The Customer model now uses proper relational references (`cityId` → City table) instead of free-text `city` and `country` fields. This improves data integrity, consistency, and enables better querying capabilities while following database normalization best practices.
