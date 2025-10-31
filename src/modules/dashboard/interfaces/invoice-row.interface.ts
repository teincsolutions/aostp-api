export interface InvoiceRowInterface {
  id: string;
  invoiceNumber: string;
  customer: string;
  total: number;
  paid: number;
  balance: number;
  status: string;
  createdAt: string;
}
