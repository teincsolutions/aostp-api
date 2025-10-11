export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  EXPORT = 'EXPORT',
}

export enum AuditEntity {
  User = 'User',
  Customer = 'Customer',
  Package = 'Package',
  Container = 'Container',
  Invoice = 'Invoice',
  Payment = 'Payment',
  Notification = 'Notification',
  ExchangeRate = 'ExchangeRate',
  Warehouse = 'Warehouse',
  ShippingRate = 'ShippingRate',
  PackingList = 'PackingList',
  PackageDelivery = 'PackageDelivery',
  OTHER = 'Other',
}

export interface AuditLog {
  id: string;
  timestamp: string; // ISO date string
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}
