import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ID_FORMATS } from '../constants/id-formats';

@Injectable()
export class IdGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate customer ID: CUST{YY}{MM}{SEQUENCE}
   */
  async generateCustomerId(): Promise<string> {
    const config = ID_FORMATS.CUSTOMER;
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const prefix = `${config.PREFIX}${year}${month}`;

    // Get the count of customers created this month
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const count = await this.prisma.customer.count({
      where: {
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const sequence = (count + 1)
      .toString()
      .padStart(config.SEQUENCE_LENGTH, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generate package tracking code: PKG-YYYYMMDD-XXXX
   * Format: PKG-20250821-0001
   */
  async generatePackageTrackingCode(): Promise<string> {
    const config = ID_FORMATS.PACKAGE_TRACKING;
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;

    // Get the count of packages created today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await this.prisma.package.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (count + 1)
      .toString()
      .padStart(config.SEQUENCE_LENGTH, '0');
    return `${config.PREFIX}-${dateStr}-${sequence}`;
  }

  /**
   * Generate packing list name: PL-{YYYY}-{MM}-{DD}-{CONTAINER_NO}
   */
  generatePackingListName(loadingDate: Date, containerNumber: string): string {
    const year = loadingDate.getFullYear();
    const month = (loadingDate.getMonth() + 1).toString().padStart(2, '0');
    const day = loadingDate.getDate().toString().padStart(2, '0');

    return `PL-${year}-${month}-${day}-${containerNumber}`;
  }

  /**
   * Generate invoice number: INV-YYYYMMDD-XXXX
   */
  async generateInvoiceNumber(): Promise<string> {
    const config = ID_FORMATS.INVOICE;
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const prefix = `${config.PREFIX}-${dateStr}-`;

    // Get the count of invoices created today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await this.prisma.invoice.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (count + 1)
      .toString()
      .padStart(config.SEQUENCE_LENGTH, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generate receipt number: RCPT-YYYYMMDD-XXXX
   */
  async generateReceiptNumber(): Promise<string> {
    const config = ID_FORMATS.RECEIPT;
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const prefix = `${config.PREFIX}-${dateStr}-`;

    // Get the count of payments created today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await this.prisma.payment.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (count + 1)
      .toString()
      .padStart(config.SEQUENCE_LENGTH, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generate package delivery ID: DLV-YYYYMMDD-XXXX
   */
  async generatePackageDeliveryId(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const prefix = `DLV-${dateStr}-`;

    // Get the count of deliveries created today
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await this.prisma.packageDelivery.count({
      where: {
        releaseDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generate consolidated package tracking code: AOSTP-YYMM-UNIQUECODE
   * Format: AOSTP-2512-A1B2C3
   */
  generateConsolidatedPackageTrackingCode(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const dateStr = `${year}${month}`;
    const uniqueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `AOSTP-${dateStr}-${uniqueCode}`;
  }

  /**
   * Generate barcode for package tracking
   * This is a simple barcode generation - in production you might want to use a more sophisticated library
   */
  generateBarcode(trackingCode: string): string {
    // Simple barcode representation - could be enhanced with actual barcode generation
    // For now, we'll return a standardized format that can be used with barcode generation libraries
    return `*${trackingCode}*`;
  }

  /**
   * Validate tracking code format
   */
  validateTrackingCodeFormat(trackingCode: string): boolean {
    // Allow manual tracking codes (any format) or auto-generated format
    if (!trackingCode || trackingCode.trim() === '') {
      return false;
    }

    // Check if it matches the auto-generated formats:
    // PKG-YYYYMMDD-XXXX (old format)
    const pkgPattern = /^PKG-\d{8}-\d{4}$/;
    // AOSTP-YYMM-XXXXXX (new consolidated/auto-gen format)
    const aostpPattern = /^AOSTP-\d{4}-[A-Z0-9]{6}$/;

    // Allow either auto-generated formats or any manual format (3+ characters)
    return (
      pkgPattern.test(trackingCode) ||
      aostpPattern.test(trackingCode) ||
      trackingCode.trim().length >= 3
    );
  }
}
