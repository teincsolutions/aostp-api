import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ID_FORMATS } from '../constants/id-formats';
import { randomBytes } from 'crypto';

@Injectable()
export class IdGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a short uppercase alphanumeric random suffix
   * Uses crypto.randomBytes for better randomness than Math.random
   */
  private generateRandomSuffix(length = 4): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Generate a millisecond-precision timestamp string: HHmmssSSS
   */
  private generateTimestamp(date = new Date()): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const millis = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}${minutes}${seconds}${millis}`;
  }

  /**
   * Generate customer ID: CUST{YY}{MM}-{XXXX}
   * Uses random suffix instead of DB count to avoid race conditions
   */
  generateCustomerId(): string {
    const config = ID_FORMATS.CUSTOMER;
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    const prefix = `${config.PREFIX}${year}${month}`;
    const suffix = this.generateRandomSuffix(config.SEQUENCE_LENGTH);
    return `${prefix}-${suffix}`;
  }

  /**
   * Generate package tracking code: PKG-YYYYMMDD-HHmmssSSS-XXXX
   * Uses timestamp + random suffix to avoid race conditions
   */
  generatePackageTrackingCode(): string {
    const config = ID_FORMATS.PACKAGE_TRACKING;
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const timestamp = this.generateTimestamp(date);
    const suffix = this.generateRandomSuffix(config.SEQUENCE_LENGTH);
    return `${config.PREFIX}-${dateStr}-${timestamp}-${suffix}`;
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
   * Generate invoice number: INV-YYMMDD-XXXX
   * Uses date + random suffix to avoid race conditions
   */
  generateInvoiceNumber(): string {
    const config = ID_FORMATS.INVOICE;
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const suffix = this.generateRandomSuffix(config.SEQUENCE_LENGTH);
    return `${config.PREFIX}-${dateStr}-${suffix}`;
  }

  /**
   * Generate receipt number: RCPT-YYMMDD-XXXX
   * Uses date + random suffix to avoid race conditions
   */
  generateReceiptNumber(): string {
    const config = ID_FORMATS.RECEIPT;
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const suffix = this.generateRandomSuffix(config.SEQUENCE_LENGTH);
    return `${config.PREFIX}-${dateStr}-${suffix}`;
  }

  /**
   * Generate package delivery ID: DLV-YYYYMMDD-HHmmssSSS-XXXX
   * Uses timestamp + random suffix to avoid race conditions
   */
  generatePackageDeliveryId(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    const dateStr = `${year}${month}${day}`;
    const timestamp = this.generateTimestamp(date);
    const suffix = this.generateRandomSuffix(4);
    return `DLV-${dateStr}-${timestamp}-${suffix}`;
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
    // PKG-YYYYMMDD-HHmmssSSS-XXXX (new format)
    const pkgNewPattern = /^PKG-\d{8}-\d{9}-[A-Z0-9]{4}$/;
    // AOSTP-YYMM-XXXXXX (new consolidated/auto-gen format)
    const aostpPattern = /^AOSTP-\d{4}-[A-Z0-9]{6}$/;

    // Allow either auto-generated formats or any manual format (3+ characters)
    return (
      pkgPattern.test(trackingCode) ||
      pkgNewPattern.test(trackingCode) ||
      aostpPattern.test(trackingCode) ||
      trackingCode.trim().length >= 3
    );
  }
}
