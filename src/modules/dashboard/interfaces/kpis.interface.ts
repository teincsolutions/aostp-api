export interface KpisInterface {
  customersTotal: number;
  packagesTotal: number;
  seaTotal: number;
  airTotal: number;
  activeContainers: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesAmount: number;
  paidInvoicesAmount: number;
  paidInvoicesCount: number;
  paymentsTotals: {
    amount: number | null;
    localAmount: number | null;
  };
}
