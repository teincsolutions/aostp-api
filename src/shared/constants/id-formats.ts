/**
 * Constants for ID and Code Generation Formats
 */

export const ID_FORMATS = {
  // Customer ID format: CUST{YY}{MM}{SEQUENCE}
  CUSTOMER: {
    PREFIX: 'CUST',
    USE_YEAR: true,
    USE_MONTH: true,
    USE_DAY: false,
    SEQUENCE_LENGTH: 4,
  },

  // Container ID uses UUID internally + manual container number field
  CONTAINER: {
    // No specific format - uses UUID + manual number
  },

  // Package tracking codes - manual by default
  PACKAGE_TRACKING: {
    PREFIX: 'PKG',
    USE_YEAR: true,
    USE_MONTH: true,
    USE_DAY: true,
    SEQUENCE_LENGTH: 4,
    MANUAL_BY_DEFAULT: true, // Key change: manual by default
  },

  // Packing list names: PL-{DATE}-{CONTAINER_NO}
  PACKING_LIST: {
    PREFIX: 'PL',
    FORMAT: 'PL-{YYYY}-{MM}-{DD}-{CONTAINER_NO}',
  },

  // Invoice numbers: INV-YYYYMMDD-XXXX
  INVOICE: {
    PREFIX: 'INV',
    FORMAT: 'INV-{YYYYMMDD}-{SEQUENCE}',
    SEQUENCE_LENGTH: 4,
    USE_DAILY_SEQUENCE: true, // Key change: daily sequence
  },

  // Receipt numbers: RCPT-YYYYMMDD-XXXX
  RECEIPT: {
    PREFIX: 'RCPT', // Changed from PAY
    FORMAT: 'RCPT-{YYYYMMDD}-{SEQUENCE}',
    SEQUENCE_LENGTH: 4,
    USE_DAILY_SEQUENCE: true, // Key change: daily sequence
  },

  // Audit log entries use UUID
  AUDIT_LOG: {
    // Uses UUID - no specific format
  },

  // Exchange rate records use UUID
  EXCHANGE_RATE: {
    // Uses UUID - no specific format
  },
} as const;

export type IdFormatType = keyof typeof ID_FORMATS;
