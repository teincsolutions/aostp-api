# PDF Generation Tests

This directory contains tests for PDF generation with comprehensive dummy data.

## Test Files

### 1. `pdf-generation.e2e-spec.ts`
End-to-end test that generates actual PDF files with realistic dummy data and saves them to disk for visual inspection.

**Test Cases:**
- SEA shipping invoice with multiple items
- AIR EXPRESS shipping invoice
- AIR NORMAL shipping invoice with single item
- Invoice with very long text to test text wrapping and overflow handling

## Running the Tests

### Generate sample PDFs quickly (recommended for visual inspection):
```bash
npm run generate-sample-pdfs
```
This will create 3 sample PDFs in the `sample-pdfs/` directory without running full tests.

### Run all e2e tests (including PDF generation):
```bash
npm run test:e2e
```

### Run only the PDF generation test:
```bash
npm run test:pdf
```

### Run unit tests for PDF service:
```bash
npm test -- pdf.service.spec
```

## Output

Generated PDF files are saved to `test/pdf-output/` directory for visual inspection.

Example filenames:
- `invoices_invoice-INV-2026-SEA-00001.pdf`
- `invoices_invoice-INV-2026-AIR-EXPRESS-00025.pdf`
- `invoices_invoice-INV-2026-AIR-456.pdf`
- `invoices_invoice-INV-2026-LONG-TEXT-TEST.pdf`

## Test Data Scenarios

### SEA Shipping Invoice
- Multiple items (6 different products)
- Large cargo with CBM measurements
- Container tracking information
- Partial payment tracking
- Kumasi destination

### AIR EXPRESS Invoice
- Medical equipment (priority handling)
- Fully paid status
- Express delivery notes
- Accra destination

### AIR NORMAL Invoice
- Single large item
- Unpaid status
- Weight-based pricing
- Takoradi destination

### Long Text Test
- Tests text wrapping and overflow prevention
- Very long customer names
- Long item descriptions
- Ensures proper PDF layout with edge cases

## Recent Changes

**Font Size Increases:**
- All fonts increased for better readability
- Row heights adjusted to accommodate larger fonts
- Spacing optimized to prevent overflow

**Invoice Number Fix:**
- Repositioned to left of date box
- Increased width from 100 to 150 points
- Now displays full invoice number without truncation

## Verification Checklist

When reviewing generated PDFs, check:
- [ ] Invoice number displays completely without truncation
- [ ] All text is readable and properly sized
- [ ] No text overflows page edges
- [ ] Customer names wrap properly
- [ ] Item descriptions wrap within column bounds
- [ ] Totals display correctly
- [ ] Footer information is visible and not cut off
- [ ] Colors and styling are consistent
- [ ] Date formatting is correct
- [ ] All required fields are present
