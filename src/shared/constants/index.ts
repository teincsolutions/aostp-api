export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const USER_AGENT_HEADER = 'user-agent';

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  MOBILE_MONEY: 'MOBILE_MONEY',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  DIRECT_MOMO_TRANSFER: 'DIRECT_MOMO_TRANSFER',
} as const;

export const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const CUSTOMER_CODE_PREFIX = 'CUST';
export const TRACKING_CODE_PREFIX = 'PKG';
export const INVOICE_NUMBER_PREFIX = 'INV';
export const PAYMENT_CODE_PREFIX = 'PAY';

export const RETENTION_DAYS = 365; // 1 year minimum retention
