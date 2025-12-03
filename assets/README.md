# Assets Directory

This directory contains static assets used by the application.

## Company Logo

Place the company logo file here as `logo.png` for it to be embedded in all PDF documents (invoices, receipts, package intake receipts).

### Requirements:

- **Filename**: `logo.png` (or update the `COMPANY_LOGO_PATH` environment variable)
- **Format**: PNG, JPG, or JPEG
- **Recommended Size**: 200x100 pixels or similar aspect ratio
- **Background**: Transparent or white recommended

### Configuration:

Update your `.env` file with:

```
COMPANY_LOGO_PATH=./assets/logo.png
```

If the logo file is not found, PDFs will be generated without the logo, and a warning will be logged.
