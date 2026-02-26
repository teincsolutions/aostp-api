import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../storage/s3.service';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { City } from '@prisma/client';
import axios from 'axios';
import { format } from 'date-fns';
import { ToWords } from 'to-words';

// =====================
// Base interfaces
// =====================
export interface PDFTemplateData {
  [key: string]: any;
}

export interface PDFConfig {
  title: string;
  filename: string;
  type: 'invoice' | 'receipt'; // stored path hint
  template: 'invoice' | 'receipt' | 'package-intake';
  data: PDFTemplateData;
}

// =====================
// Invoice data (+package block)
// =====================
export interface InvoiceData extends PDFTemplateData {
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  invoice: {
    number: string;
    date: string; // top-right
    dueDate: string; // arrival / est. arrival
    status: string; // preserved
    shippingRate?: number; // shipping rate to display
  };

  customer: {
    code: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };

  container?: {
    number: string;
    loadingDate: string;
    origin: string;
    destination: string;
  };

  package?: {
    trackingCode: string;
    description?: string;
    shippingMode: 'SEA' | 'AIR';
    airType?: 'NORMAL_AIR' | 'EXPRESS_AIR' | 'BATTERY_GOODS' | 'PHONES';
    quantity: number; // includes sub-packages
    weightKg?: number;
    cbm?: number;
    destinationCity?: City;
    shippingRate: number;
    warehouse?: string;
    pickupCode?: string;
  };

  items?: InvoiceItem[];

  totals: {
    subtotal?: number;
    tax?: number;
    total: number;
    paid?: number;
    balance?: number;
  };

  currency: string;
  notes?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// =====================
// Package Intake (monochrome, no payment)
// =====================
export interface PackageIntakeData extends PDFTemplateData {
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  intake: {
    trackingCode: string;
    date: string;
    warehouse?: string;
    receivedBy?: string;
  };
  customer: {
    code: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  package: {
    description: string;
    shippingMode: 'SEA' | 'AIR';
    airType?: 'NORMAL_AIR' | 'EXPRESS_AIR' | 'BATTERY_GOODS' | 'PHONES';
    quantity: number;
    weightKg?: number;
    cbm?: number;
    destinationCity?: City;
  };
  notes?: string;
  photos?: Array<{ url: string; key: string }>;
}

// =====================
// Payment receipt (monochrome) + package summary
// =====================
export interface ReceiptData extends PDFTemplateData {
  receipt: {
    number: string;
    date: string;
    paymentMethod: string;
    processedBy?: string;
  };
  customer: {
    code: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  payment: {
    amount: number;
    localAmount: number;
    currency: string;
    reference?: string;
  };
  invoices: Array<{
    number: string;
    total: number;
    paid: number;
    balance: number;
    packingListName?: string;
    packageCount?: number; // Quantity of items in the specific package for this invoice
    package: {
      trackingCode?: string;
      pickupCode?: string;
    };
  }>;
  notes?: string;
}

// =====================
// THEME + HELPERS (strict to your enums)
// =====================
type ThemeKey =
  | 'SEA'
  | 'AIR_NORMAL'
  | 'AIR_EXPRESS'
  | 'AIR_BATTERY'
  | 'AIR_PHONES';

const THEMES: Record<
  ThemeKey,
  {
    band: string; // header band color
    bandLabel: string; // title inside band
    tableHeadBg: string; // head row bg
    nbStrip: string; // red NB strip
    totalsBg: string; // totals pill bg
    totalsFg: string; // totals text
    currencyFallback: 'USD' | 'GHS';
  }
> = {
  SEA: {
    band: '#1F75FE',
    bandLabel: 'SEA SHIPPING INVOICE',
    tableHeadBg: '#F1F1F1',
    nbStrip: '#D32F2F',
    totalsBg: '#9B1B1B',
    totalsFg: '#FFFFFF',
    currencyFallback: 'USD',
  },
  AIR_NORMAL: {
    band: '#10A74E',
    bandLabel: 'AIR FREIGHT INVOICE',
    tableHeadBg: '#E9E9E9',
    nbStrip: '#D32F2F',
    totalsBg: '#C73C3C',
    totalsFg: '#FFFFFF',
    currencyFallback: 'USD',
  },
  AIR_EXPRESS: {
    band: '#F6B700',
    bandLabel: '24-HOUR AIR FREIGHT INVOICE',
    tableHeadBg: '#EDEDED',
    nbStrip: '#D32F2F',
    totalsBg: '#9B1B1B',
    totalsFg: '#FFFFFF',
    currencyFallback: 'USD',
  },
  AIR_BATTERY: {
    band: '#C2185B',
    bandLabel: 'BATTERY GOODS INVOICE',
    tableHeadBg: '#EDEDED',
    nbStrip: '#D32F2F',
    totalsBg: '#9B1B1B',
    totalsFg: '#FFFFFF',
    currencyFallback: 'USD',
  },
  AIR_PHONES: {
    band: '#6F2DBD',
    bandLabel: 'AIR FREIGHT INVOICE (PHONES, TABLETS & LAPTOPS)',
    tableHeadBg: '#EDEDED',
    nbStrip: '#D32F2F',
    totalsBg: '#111111',
    totalsFg: '#FFFFFF',
    currencyFallback: 'GHS',
  },
};

function resolveThemeFromData(data: InvoiceData): ThemeKey {
  const explicitMode = (
    (data as any).shippingMode ||
    data.package?.shippingMode ||
    ''
  ).toUpperCase();
  const explicitAir = (
    (data as any).airType ||
    data.package?.airType ||
    ''
  ).toUpperCase();

  if (explicitMode === 'SEA') return 'SEA';
  if (explicitMode === 'AIR') {
    switch (explicitAir) {
      case 'EXPRESS_AIR':
        return 'AIR_EXPRESS';
      case 'BATTERY_GOODS':
        return 'AIR_BATTERY';
      case 'PHONES':
        return 'AIR_PHONES';
      default:
        return 'AIR_NORMAL';
    }
  }
  return 'AIR_NORMAL';
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function safe(v?: string | number | null) {
  return (v ?? '').toString().trim();
}

// ---- Format date as "22nd Jul, 2024" using date-fns ----
function formatDate(dateString: string): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    // Use date-fns format with 'do' for ordinal day (1st, 2nd, 3rd, etc.)
    return format(date, 'do MMM, yyyy');
  } catch (error) {
    return dateString;
  }
}

// ---- Single-line, no-wrap, width-clamped with ellipsis ----
function writeLineClamped(
  doc: PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'center' | 'right' = 'left',
) {
  let s = text ?? '';
  while (doc.widthOfString(s) > width && s.length > 1) {
    s = s.slice(0, -1);
  }
  if (s !== text && s.length > 1) {
    if (width >= doc.widthOfString('…')) {
      while (doc.widthOfString(s + '…') > width && s.length > 1) {
        s = s.slice(0, -1);
      }
      s = s + '…';
    }
  }
  // IMPORTANT: lineBreak:false to avoid vertical flow changes
  doc.text(s, x, y, { width, align, lineBreak: false });
}

// ---- Multi-line text with wrapping and center alignment ----
function writeTextWrapped(
  doc: PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'center' | 'right' = 'left',
): number {
  const s = text ?? '';
  doc.text(s, x, y, { width, align, lineBreak: true });
  // Return the height of the rendered text
  return doc.heightOfString(s, { width, align, lineBreak: true });
}

// =====================
// LAYOUT CONSTANTS (adjusted for A5)
// =====================
const LAYOUT = {
  // general
  margin: 16, // increased for A5
  topY: 20, // header top Y - increased to give more space for invoice number
  line: 1,

  // header/company/date
  companyFont: 18, // larger for A5
  addressFont: 10, // increased from 9
  dateBoxW: 100, // wider for A5
  rateBoxW: 150,
  dateBoxH: 16,
  dateFont: 12,
  rateFont: 11, // increased from 10
  invoiceNumberFont: 11, // new: dedicated font size for invoice number
  invoiceNumberWidth: 150, // new: wider width for invoice number

  // colored band
  bandHeight: 20, // taller for A5
  bandFont: 13, // increased from 12

  // package slab
  pkgSlabH: 32,
  pkgFont: 10, // increased from 9

  // table
  headH: 26,
  headFont: 11, // increased from 10
  rowH: 16, // increased from 14 to accommodate larger font
  rowFont: 11, // increased from 10

  // totals + strips
  pillW: 180, // increased from 160 to accommodate larger font
  pillH: 28, // increased from 26 for better spacing
  pillFont: 13, // increased from 12
  nbStripH: 14, // increased from 12 for larger font
  nbFont: 9, // increased from 8
  bottomInfoFont: 10, // increased from 9

  // reserved vertical block at bottom (pill + strips area)
  bottomReserved: 82, // increased from 76 to accommodate larger elements
};

// =====================
// Service
// =====================
@Injectable()
export class PDFService {
  private readonly logger = new Logger(PDFService.name);
  private readonly bucket: string;
  private readonly companyInfo: {
    name: string;
    phone: string;
    branches: string;
    email: string;
    logoPath?: string;
    momoNumber?: string;
    momoName?: string;
  };
  private companyLogo: Buffer | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    this.bucket = this.configService.getOrThrow<string>(
      'AWS_PACKAGES_BUCKET_NAME',
    );

    // Set company info with environment variables or defaults
    this.companyInfo = {
      name:
        this.configService.get<string>('COMPANY_NAME') ||
        'AKOMAPA ONE STOP TRADE PROVIDER LTD (AOSTP)',
      phone: this.configService.get<string>('COMPANY_PHONE') || '053777 6709',
      branches:
        this.configService.get<string>('COMPANY_BRANCHES') ||
        'ACCRA, KUMASI, HO, TAKORADI',
      email:
        this.configService.get<string>('COMPANY_EMAIL') ||
        'info@akomapacargo.com',
      logoPath: this.configService.get<string>('COMPANY_LOGO_PATH'),
      momoNumber:
        this.configService.get<string>('COMPANY_MOMO_NUMBER') || '0539 766 892',
      momoName:
        this.configService.get<string>('COMPANY_MOMO_NAME') ||
        'AKOMAPA ONE STOP TRADE PROVIDER - YANG QIAOLING',
    };

    // Load company logo if path is provided (fire and forget)
    void this.loadCompanyLogo();
  }

  /**
   * Load company logo from file system
   */
  private async loadCompanyLogo(): Promise<void> {
    if (!this.companyInfo.logoPath) {
      this.logger.warn('No company logo path configured');
      return;
    }

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const logoPath = path.resolve(process.cwd(), this.companyInfo.logoPath);
      this.companyLogo = await fs.readFile(logoPath);
      this.logger.log(`Company logo loaded from ${logoPath}`);
    } catch (error) {
      this.logger.error('Failed to load company logo', error);
      this.companyLogo = null;
    }
  }

  // --------- Public API ---------
  async generatePDF(config: PDFConfig): Promise<{ url: string; key: string }> {
    this.logger.log(`Generating ${config.type} PDF for ${config.title}`);

    const pdfBuffer = await this.createPDF(config);

    const folderMap = {
      invoice: 'invoices',
      receipt: 'receipts',
    } as const;

    const folder = (folderMap as any)[config.type] || 'documents';
    const key = `${folder}/${config.filename}.pdf`;

    const s3Result = await this.s3Service.uploadFileWithBucket(
      this.bucket,
      key,
      pdfBuffer,
      'application/pdf',
    );

    this.logger.log(`${config.type} PDF generated: ${config.filename}`);
    return { url: s3Result.url, key };
  }

  async generateInvoicePDF(
    invoiceData: InvoiceData,
  ): Promise<{ url: string; key: string }> {
    const config: PDFConfig = {
      title: `Invoice ${invoiceData.invoice.number}`,
      filename: `invoice-${invoiceData.invoice.number}`,
      type: 'invoice',
      template: 'invoice',
      data: invoiceData,
    };
    return this.generatePDF(config);
  }

  async generateReceiptPDF(
    receiptData: ReceiptData,
  ): Promise<{ url: string; key: string }> {
    const config: PDFConfig = {
      title: `Receipt ${receiptData.receipt.number}`,
      filename: `receipt-${receiptData.receipt.number}`,
      type: 'receipt',
      template: 'receipt',
      data: receiptData,
    };
    return this.generatePDF(config);
  }

  async generatePackageIntakePDF(
    intakeData: PackageIntakeData,
  ): Promise<{ url: string; key: string }> {
    const config: PDFConfig = {
      title: `Package Intake ${intakeData.intake.trackingCode}`,
      filename: `package-intake-${intakeData.intake.trackingCode}`,
      type: 'receipt', // store under receipts
      template: 'package-intake',
      data: intakeData,
    };
    return this.generatePDF(config);
  }

  // =====================
  // Core create PDF
  // =====================
  private async createPDF(config: PDFConfig): Promise<Buffer> {
    const chunks: Buffer[] = [];

    // Use A4 for package intake receipts, A5 landscape for invoices/receipts
    const pageSize = config.template === 'package-intake' ? 'A4' : 'A5';
    const pageLayout =
      config.template === 'package-intake' ? 'portrait' : 'landscape';

    const doc = new PDFDocument({
      size: pageSize,
      layout: pageLayout,
      margin: LAYOUT.margin,
      bufferPages: false, // do not buffer
    });

    const stream = new PassThrough();

    // Create promise to wait for stream completion
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    doc.pipe(stream);

    try {
      await this.generateContent(doc, config);
      doc.end();
      return await bufferPromise;
    } catch (error: any) {
      doc.end();
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  private async generateContent(
    doc: PDFDocument,
    config: PDFConfig,
  ): Promise<void> {
    switch (config.template) {
      case 'invoice':
        this.generateInvoiceContent(doc, config.data as InvoiceData);
        break;
      case 'receipt':
        this.generateReceiptContent(doc, config.data as ReceiptData);
        break;
      case 'package-intake':
        await this.generatePackageIntakeContent(
          doc,
          config.data as PackageIntakeData,
        );
        break;
      default:
        throw new Error(`Unknown template: ${String(config.template)}`);
    }
  }

  // =====================
  // REUSABLE COMPONENT METHODS
  // =====================

  private drawHeader(
    doc: PDFDocument,
    data: InvoiceData,
    contentW: number,
    L: number,
    R: number,
  ): number {
    const dateBoxX = R - LAYOUT.dateBoxW;
    const rateBoxX = R - LAYOUT.rateBoxW;
    const dateBoxY = LAYOUT.topY;

    // Company logo (top-left)
    const logoWidth = 60;
    const logoHeight = 40;
    if (this.companyLogo) {
      try {
        doc.image(this.companyLogo, L, LAYOUT.topY, {
          fit: [logoWidth, logoHeight],
          align: 'left',
        });
      } catch (error) {
        this.logger.warn('Failed to embed logo in invoice header', error);
        // Draw placeholder box if logo fails
        doc.rect(L, LAYOUT.topY, logoWidth, logoHeight).stroke();
      }
    } else {
      // Draw placeholder box if no logo available
      doc.rect(L, LAYOUT.topY, logoWidth, logoHeight).stroke();
    }

    // Company name (center) - allow wrapping
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont).fillColor('#000');
    const nameWidth = contentW - 60 - LAYOUT.dateBoxW - 6;
    const nameHeight = writeTextWrapped(
      doc,
      safe(this.companyInfo.name),
      L + 40,
      LAYOUT.topY,
      nameWidth,
      'center',
    );

    // Invoice number (above date box) - positioned to left of date box for more space
    const invoiceNumberX = dateBoxX - LAYOUT.invoiceNumberWidth - 10;
    doc.fillColor('#000').fontSize(LAYOUT.invoiceNumberFont).font('Helvetica-Bold');
    writeLineClamped(
      doc,
      `Invoice: ${data.invoice.number}`,
      invoiceNumberX,
      dateBoxY - 14,
      LAYOUT.invoiceNumberWidth,
      'right',
    );

    // Date + address (right)
    doc
      .roundedRect(dateBoxX, dateBoxY, LAYOUT.dateBoxW, LAYOUT.dateBoxH, 2)
      .fill('#E6E6E6');
    doc.fillColor('#000').fontSize(LAYOUT.dateFont).font('Helvetica-Bold');
    writeLineClamped(
      doc,
      formatDate(data.invoice.date),
      dateBoxX,
      dateBoxY + 3,
      LAYOUT.dateBoxW,
      'center',
    );

    // Shipping rate below date box
    let nextY = dateBoxY + LAYOUT.dateBoxH + 4;
    if (data.package?.shippingRate != null) {
      doc.fontSize(LAYOUT.rateFont).font('Helvetica-Bold');
      writeLineClamped(
        doc,
        `Shipping Rate: ${data.currency || 'USD'} ${fmt(data.package.shippingRate)}`,
        rateBoxX,
        nextY,
        LAYOUT.rateBoxW,
        'center',
      );
      nextY += 13;
    }

    // Branches (below date box or shipping rate)
    let branchesHeight = 0;
    if (safe(this.companyInfo.branches)) {
      doc.font('Helvetica').fontSize(LAYOUT.addressFont).fillColor('#000');
      branchesHeight = writeTextWrapped(
        doc,
        `Branches: ${safe(this.companyInfo.branches)}`,
        dateBoxX - 50,
        nextY,
        130,
        'right',
      );
    }

    // Return next Y position based on max height of name or branches
    const maxHeight = Math.max(
      nameHeight + LAYOUT.topY,
      nextY + branchesHeight,
    );
    return maxHeight + 12; // Return next Y position
  }

  private drawBand(
    doc: PDFDocument,
    data: InvoiceData,
    contentW: number,
    L: number,
    bandY: number,
  ): number {
    const theme = THEMES[resolveThemeFromData(data)];
    doc.rect(L, bandY, contentW, LAYOUT.bandHeight).fill(theme.band);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(LAYOUT.bandFont);
    writeLineClamped(
      doc,
      theme.bandLabel,
      L + 6,
      bandY + 2.5, // adjusted from 3 to better center with larger font
      contentW - 12,
      'center',
    );
    return bandY + LAYOUT.bandHeight + 5; // Return next Y position
  }

  private drawCustomerDetails(
    doc: PDFDocument,
    data: InvoiceData,
    contentW: number,
    L: number,
    customerY: number,
  ): number {
    // Customer details in two columns beneath the band
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(10); // increased from 9
    writeLineClamped(doc, 'CUSTOMER:', L, customerY, 100, 'left');

    const contact = data.customer?.phone || data.customer?.email || '';
    writeLineClamped(
      doc,
      `CONTACT: ${contact}`,
      L + contentW * 0.7,
      customerY + 6,
      120,
      'left',
    );

    // Destination City below contact
    if (data.package?.destinationCity) {
      writeLineClamped(
        doc,
        `Dest. City: ${data.package.destinationCity.name}`,
        L + contentW * 0.7,
        customerY + 20, // increased from 18
        120,
        'left',
      );
    }

    // Customer name - use multi-line wrapping
    doc.font('Helvetica').fontSize(12);
    const customerName =
      `${data.customer?.name} (${data.customer?.code})`.toUpperCase();
    const nameHeight = writeTextWrapped(
      doc,
      customerName,
      L,
      customerY + 13, // increased from 12
      contentW * 0.5,
      'left',
    );

    // Add extra line spacing after customer name
    return customerY + 13 + nameHeight + 14; // Return next Y position with extra line
  }

  private drawTableWithTotals(
    doc: PDFDocument,
    data: InvoiceData,
    contentW: number,
    L: number,
    R: number,
    H: number,
    tableY: number,
  ): void {
    const theme = THEMES[resolveThemeFromData(data)];
    const currency = (data.currency || theme.currencyFallback).toUpperCase();

    // Divider
    doc
      .moveTo(L, tableY)
      .lineTo(R, tableY)
      .strokeColor('#CCCCCC')
      .lineWidth(LAYOUT.line)
      .stroke();

    // Table header
    const headY = tableY + 4;
    doc.rect(L, headY, contentW, LAYOUT.headH).fill(theme.tableHeadBg);
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(LAYOUT.headFont);

    // 4 columns: description+trackingCode, weight/cbm (SEA only), qty, amount
    const cols = [
      {
        x: L + 6,
        w: contentW * 0.5,
        label: 'DESCRIPTION',
        align: 'left' as const,
      },
      {
        x: L + contentW * 0.55 + 6,
        w: contentW * 0.15,
        label: data.package?.shippingMode === 'SEA' ? 'CBM' : 'WEIGHT (KG)',
        align: 'left' as const,
      },
      {
        x: L + contentW * 0.65 + 6,
        w: contentW * 0.15,
        label: 'QTY',
        align: 'center' as const,
      },
      {
        x: L + contentW * 0.75 + 6,
        w: contentW * 0.22,
        label: `AMOUNT (USD)`,
        align: 'right' as const,
      },
    ];
    cols.forEach((c) =>
      writeLineClamped(doc, c.label, c.x, headY + 6, c.w, c.align), // adjusted from 5 to 6 for better centering
    );

    // Rows — height-limited to fit one page
    let y = headY + LAYOUT.headH + 5;
    const bottomReserved = LAYOUT.bottomReserved + 30; // Extra space for totals pill
    const maxY = H - doc.page.margins.bottom - bottomReserved;
    const availableRows = Math.max(0, Math.floor((maxY - y) / LAYOUT.rowH));

    doc.font('Helvetica').fontSize(LAYOUT.rowFont).fillColor('#000');

    const rows: InvoiceItem[] =
      (data.items?.length ?? 0) > 0
        ? data.items!.map((item) => ({
            ...item,
            description: `${item.description}${data.package?.trackingCode ? `\nTracking: ${data.package.trackingCode}` : ''}`,
          }))
        : [
            {
              description: `${data.package?.description || ''}${data.package?.trackingCode ? `\nTracking: ${data.package.trackingCode}` : ''}${data.package?.pickupCode ? `\nPickup Code: ${data.package.pickupCode}` : ''}`,
              quantity: data.package?.quantity ?? 1,
              unitPrice:
                (data.totals?.total ?? 0) / (data.package?.quantity ?? 1),
              total: data.totals?.total ?? 0,
            },
          ];

    const showCount = Math.min(rows.length, availableRows);
    const overflow = rows.length - showCount;

    for (let i = 0; i < showCount; i++) {
      const it = rows[i];

      // Use writeTextWrapped for description to allow multi-line text
      const descHeight = writeTextWrapped(
        doc,
        it.description || '',
        cols[0].x,
        y,
        cols[0].w,
        'left',
      );

      // Weight/cbm for SEA, empty for AIR
      let weightCbmText = '';
      if (data.package?.shippingMode === 'SEA') {
        weightCbmText = `${data.package.cbm}`;
      } else {
        weightCbmText = `${data.package?.weightKg}`;
      }
      writeLineClamped(doc, weightCbmText, cols[1].x, y, cols[1].w, 'left');

      writeLineClamped(
        doc,
        String(it.quantity ?? 0),
        cols[2].x,
        y,
        cols[2].w,
        'center',
      );
      writeLineClamped(
        doc,
        fmt(it.total ?? 0),
        cols[3].x,
        y,
        cols[3].w,
        'right',
      );

      // Use the actual height of the description or minimum row height
      const rowActualHeight = Math.max(descHeight, LAYOUT.rowH);
      y += rowActualHeight;
    }

    if (overflow > 0 && y <= maxY) {
      doc.font('Helvetica-Oblique').fontSize(LAYOUT.rowFont);
      writeLineClamped(
        doc,
        `(+${overflow} more items)`,
        cols[0].x,
        y,
        contentW - 12,
        'left',
      );
      y += LAYOUT.rowH;
    }

    // Payment instruction message
    if (y + 35 <= maxY) { // increased from 30 to account for larger font
      y += 10; // increased from 8 for better spacing
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000'); // increased from 8
      writeLineClamped(
        doc,
        'Kindly start making payments as soon you receive your invoice to the momo account below',
        L + 6,
        y,
        contentW - 12,
        'left',
      );
      y += 12; // increased from 10
      doc.font('Helvetica-Bold').fontSize(9); // increased from 8
      writeLineClamped(
        doc,
        `MOMO NUMBER: ${safe(this.companyInfo.momoNumber)}`,
        L + 6,
        y,
        contentW - 12,
        'left',
      );
      y += 12; // increased from 10
      writeLineClamped(
        doc,
        `NAME: ${safe(this.companyInfo.momoName)}`,
        L + 6,
        y,
        contentW - 12,
        'left',
      );
    }
  }

  private drawStrip(
    doc: PDFDocument,
    data: InvoiceData,
    contentW: number,
    L: number,
    R: number,
    H: number,
  ): void {
    // Totals pill (bottom-right)
    const theme = THEMES[resolveThemeFromData(data)];
    const currency = (data.currency || theme.currencyFallback).toUpperCase();

    const pillX = R - LAYOUT.pillW;
    const pillY = H - doc.page.margins.bottom - 74; // adjusted from 70 for larger pill
    doc
      .roundedRect(pillX, pillY, LAYOUT.pillW, LAYOUT.pillH, 3)
      .fill(theme.totalsBg);
    doc
      .fillColor(theme.totalsFg)
      .font('Helvetica-Bold')
      .fontSize(LAYOUT.pillFont);
    writeLineClamped(
      doc,
      `TOTAL: ${currency} ${fmt(data.totals.total)}`,
      pillX + 8,
      pillY + 5, // adjusted from 4 for better centering
      LAYOUT.pillW - 16,
      'center',
    );

    // NB strip
    const nbY = H - doc.page.margins.bottom - 44; // adjusted from 40 for larger strip
    doc.rect(L, nbY, contentW, LAYOUT.nbStripH).fill(theme.nbStrip);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(LAYOUT.nbFont);
    writeLineClamped(
      doc,
      `NB: ETA values are estimates and can be affected by unforeseen circumstances.`,
      L + 5,
      nbY + 2.5, // adjusted for better centering with larger font
      contentW - 10,
      'left',
    );

    // Arrival / MoMo strip (single line) - ensure it stays within page bounds
    const bottomY = H - doc.page.margins.bottom - 26; // adjusted from 24 for larger font
    doc
      .font('Helvetica-Bold')
      .fontSize(LAYOUT.bottomInfoFont)
      .fillColor('#000');
    const phone = safe(this.companyInfo.phone);
    writeLineClamped(
      doc,
      phone ? `CALL/WHATSAPP: ${phone}` : `CALL/WHATSAPP:`,
      L,
      bottomY,
      contentW * 0.5,
      'left',
    );

    const label =
      resolveThemeFromData(data) === 'SEA' ||
      resolveThemeFromData(data) === 'AIR_EXPRESS'
        ? 'EST. ARRIVAL:'
        : 'ARRIVAL:';
    writeLineClamped(
      doc,
      `${label} ${formatDate(data.invoice?.dueDate || '')}`,
      L + contentW * 0.5,
      bottomY,
      contentW * 0.5,
      'right',
    );
  }

  // =====================
  // INVOICE (A6 themed, PACKAGE summary) — single-page fit
  // =====================
  private generateInvoiceContent(doc: PDFDocument, data: InvoiceData): void {
    const W = doc.page.width;
    const H = doc.page.height;
    const L = doc.page.margins.left;
    const R = W - doc.page.margins.right;
    const contentW = R - L;

    // Call reusable component methods
    let currentY = this.drawHeader(doc, data, contentW, L, R);
    currentY = this.drawBand(doc, data, contentW, L, currentY);
    currentY = this.drawCustomerDetails(doc, data, contentW, L, currentY);
    this.drawTableWithTotals(doc, data, contentW, L, R, H, currentY);
    this.drawStrip(doc, data, contentW, L, R, H);
  }

  // =====================
  // PACKAGE INTAKE (A4, monochrome) — single-page fit
  // =====================
  private async generatePackageIntakeContent(
    doc: PDFDocument,
    data: PackageIntakeData,
  ): Promise<void> {
    const W = doc.page.width;
    const H = doc.page.height;
    const L = doc.page.margins.left;
    const R = W - doc.page.margins.right;
    const contentW = R - L;

    doc.fillColor('#000');

    // Header with logo
    let headerY = LAYOUT.topY;

    // Embed logo at top-left
    const intakeLogoWidth = 80;
    const intakeLogoHeight = 50;
    if (this.companyLogo) {
      try {
        doc.image(this.companyLogo, L, headerY, {
          fit: [intakeLogoWidth, intakeLogoHeight],
          align: 'left',
        });
      } catch (error) {
        this.logger.warn('Failed to embed logo in package intake PDF', error);
      }
    }

    // Company name - allow wrapping (positioned to the right of logo)
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont);
    const nameHeight = writeTextWrapped(
      doc,
      safe(this.companyInfo.name),
      L + intakeLogoWidth + 10,
      headerY,
      contentW - intakeLogoWidth - 10,
      'left',
    );
    headerY += Math.max(intakeLogoHeight, nameHeight) + 4;

    // Branches - allow wrapping
    doc.fontSize(9).font('Helvetica');
    const branchesHeight = writeTextWrapped(
      doc,
      `Branches: ${safe(this.companyInfo.branches)}`,
      L,
      headerY,
      contentW,
      'center',
    );
    headerY += branchesHeight + 4;

    // Contact info - allow wrapping
    const contactHeight = writeTextWrapped(
      doc,
      `Contact: ${safe(this.companyInfo.phone)} | Email: ${safe(this.companyInfo.email)}`,
      L,
      headerY,
      contentW,
      'center',
    );
    headerY += contactHeight;

    // Title rule + title
    const titleY = headerY + 10;
    doc.moveTo(L, titleY).lineTo(R, titleY).lineWidth(LAYOUT.line).stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    writeLineClamped(
      doc,
      'PACKAGE INTAKE RECEIPT',
      L,
      titleY + 4,
      contentW,
      'center',
    );
    doc
      .moveTo(L, titleY + 20)
      .lineTo(R, titleY + 20)
      .lineWidth(LAYOUT.line)
      .stroke();

    // Two columns meta
    const metaY = titleY + 28;
    const midX = L + contentW * 0.52;

    doc.font('Helvetica-Bold').fontSize(9);
    writeLineClamped(doc, 'Intake Code:', L, metaY, 72, 'left');
    writeLineClamped(doc, 'Date:', L, metaY + 12, 72, 'left');
    writeLineClamped(doc, 'Warehouse:', L, metaY + 24, 72, 'left');
    writeLineClamped(doc, 'Received By:', L, metaY + 36, 72, 'left');

    doc.font('Helvetica').fontSize(9);
    writeLineClamped(
      doc,
      safe(data.intake.trackingCode),
      L + 72,
      metaY,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      formatDate(data.intake.date),
      L + 72,
      metaY + 12,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.intake.warehouse),
      L + 72,
      metaY + 24,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.intake.receivedBy),
      L + 72,
      metaY + 36,
      140,
      'left',
    );

    doc.font('Helvetica-Bold').fontSize(9);
    writeLineClamped(doc, 'Customer:', midX, metaY, 70, 'left');
    doc.font('Helvetica').fontSize(9);
    writeLineClamped(
      doc,
      safe(data.customer.name),
      midX + 58,
      metaY,
      contentW - (midX + 58 - L),
      'left',
    );
    writeLineClamped(
      doc,
      `Code: ${safe(data.customer.code)}`,
      midX,
      metaY + 12,
      contentW - (midX - L),
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.customer.phone),
      midX,
      metaY + 24,
      contentW - (midX - L),
      'left',
    );
    if (safe(data.customer.email)) {
      writeLineClamped(
        doc,
        safe(data.customer.email),
        midX,
        metaY + 36,
        contentW - (midX - L),
        'left',
      );
    }

    // Package details box
    const boxW = contentW;
    const boxH = 72; // Increased height to accommodate multi-line description
    const boxY = metaY + 66; // Increased from 54 to account for extra row
    doc.roundedRect(L, boxY, boxW, boxH, 3).stroke();

    let py = boxY + 8;
    doc.font('Helvetica-Bold').fontSize(10);
    writeLineClamped(doc, 'PACKAGE DETAILS', L + 8, py, boxW - 16, 'left');
    py += 14;

    doc.font('Helvetica').fontSize(8);
    // Use writeTextWrapped to allow multi-line description
    const descHeight = writeTextWrapped(
      doc,
      `Description: ${safe(data.package.description)} • Mode: ${data.package.shippingMode}${data.package.airType ? ` / ${data.package.airType.replace('_', ' ')}` : ''}`,
      L + 8,
      py,
      boxW - 16,
      'left',
    );
    py += descHeight + 3;

    writeLineClamped(
      doc,
      `Qty: ${data.package.quantity} ${data.package.destinationCity ? ` • Dest: ${data.package.destinationCity.name}` : ''}`,
      L + 8,
      py,
      boxW - 16,
      'left',
    );

    // Notes (single line)
    const notesY = boxY + boxH + 8;
    if (safe(data.notes)) {
      doc.font('Helvetica-Bold').fontSize(9);
      writeLineClamped(doc, 'Notes:', L, notesY, 44, 'left');
      doc.font('Helvetica').fontSize(8);
      writeLineClamped(
        doc,
        safe(data.notes),
        L + 42,
        notesY,
        contentW - 42,
        'left',
      );
    }

    // Package Photos Section
    let photoSectionEndY = notesY + 14;
    if (data.photos && data.photos.length > 0) {
      const photoY = notesY + 20;
      doc.font('Helvetica-Bold').fontSize(10);
      writeLineClamped(doc, 'PACKAGE PHOTOS', L, photoY, contentW, 'left');

      // Draw a horizontal line under the header
      doc
        .moveTo(L, photoY + 14)
        .lineTo(R, photoY + 14)
        .lineWidth(0.5)
        .stroke();

      // Embed photos in a grid (max 3 per row on A4)
      const photoStartY = photoY + 20;
      const photoWidth = 150;
      const photoHeight = 120;
      const photoSpacing = 15;
      const photosPerRow = 3;

      let currentX = L;
      let currentY = photoStartY;
      let photoCount = 0;

      // Limit to first 6 photos to keep it on one page
      const photosToDisplay = data.photos.slice(0, 6);

      for (const photo of photosToDisplay) {
        try {
          const imageBuffer = await this.fetchImageFromUrl(photo.url);

          // Draw border around photo
          doc.rect(currentX, currentY, photoWidth, photoHeight).stroke();

          // Embed image with fit and center
          doc.image(imageBuffer, currentX + 5, currentY + 5, {
            fit: [photoWidth - 10, photoHeight - 10],
            align: 'center',
            valign: 'center',
          });

          photoCount++;

          // Move to next position
          if (photoCount % photosPerRow === 0) {
            // Move to next row
            currentX = L;
            currentY += photoHeight + photoSpacing;
          } else {
            // Move to next column
            currentX += photoWidth + photoSpacing;
          }
        } catch (error) {
          this.logger.warn(`Failed to embed photo ${photo.key}`, error);
          // Draw placeholder on error
          doc
            .rect(currentX, currentY, photoWidth, photoHeight)
            .stroke()
            .fontSize(8)
            .text('Photo unavailable', currentX, currentY + photoHeight / 2, {
              width: photoWidth,
              align: 'center',
            });

          photoCount++;
          if (photoCount % photosPerRow === 0) {
            currentX = L;
            currentY += photoHeight + photoSpacing;
          } else {
            currentX += photoWidth + photoSpacing;
          }
        }
      }

      // Calculate the end Y position of photo section
      const rows = Math.ceil(photosToDisplay.length / photosPerRow);
      photoSectionEndY = photoStartY + rows * (photoHeight + photoSpacing) + 10;
    }

    // Footer rule + footer
    doc
      .moveTo(L, H - 22)
      .lineTo(R, H - 22)
      .lineWidth(LAYOUT.line)
      .stroke();
    doc.font('Helvetica').fontSize(8);
    writeLineClamped(
      doc,
      `Generated on ${new Date().toLocaleDateString()} by ${this.companyInfo.name}`,
      L,
      H - 28,
      contentW,
      'center',
    );
  }

  // =====================
  // RECEIPT (A6, monochrome, PACKAGE summary) — single-page fit
  // =====================
  private generateReceiptContent(doc: PDFDocument, data: ReceiptData): void {
    // Validate required data
    if (!data.customer) {
      throw new Error('Customer data is missing from receipt data');
    }
    if (!data.payment) {
      throw new Error('Payment data is missing from receipt data');
    }
    if (!data.receipt) {
      throw new Error('Receipt data is missing from receipt data');
    }
    if (!data.invoices) {
      throw new Error('Invoices data is missing from receipt data');
    }

    const W = doc.page.width;
    const H = doc.page.height;
    const L = doc.page.margins.left;
    const R = W - doc.page.margins.right;
    const contentW = R - L;

    doc.fillColor('#000');

    // Header
    let receiptHeaderY = LAYOUT.topY;

    // Company logo (top-left)
    const receiptLogoWidth = 60;
    const receiptLogoHeight = 40;
    if (this.companyLogo) {
      try {
        doc.image(this.companyLogo, L, receiptHeaderY, {
          fit: [receiptLogoWidth, receiptLogoHeight],
          align: 'left',
        });
      } catch (error) {
        this.logger.warn('Failed to embed logo in receipt header', error);
      }
    }

    // Company name - allow wrapping (positioned to the right of logo)
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont);
    const receiptNameHeight = writeTextWrapped(
      doc,
      safe(this.companyInfo.name),
      L + receiptLogoWidth + 6,
      receiptHeaderY,
      contentW - receiptLogoWidth - 6,
      'left',
    );
    receiptHeaderY += Math.max(receiptLogoHeight, receiptNameHeight) + 2;

    // Branches - allow wrapping
    doc.fontSize(9).font('Helvetica');
    const receiptBranchesHeight = writeTextWrapped(
      doc,
      `Branches: ${safe(this.companyInfo.branches)}`,
      L,
      receiptHeaderY,
      contentW,
      'center',
    );
    receiptHeaderY += receiptBranchesHeight + 2;

    // Contact info - allow wrapping
    const receiptContactHeight = writeTextWrapped(
      doc,
      `Contact: ${safe(this.companyInfo.phone)} | Email: ${safe(this.companyInfo.email)}`,
      L,
      receiptHeaderY,
      contentW,
      'center',
    );
    receiptHeaderY += receiptContactHeight;

    // Title rule + title
    const titleRuleY = receiptHeaderY + 10;
    doc
      .moveTo(L, titleRuleY)
      .lineTo(R, titleRuleY)
      .lineWidth(LAYOUT.line)
      .stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    writeLineClamped(
      doc,
      'PAYMENT RECEIPT',
      L,
      titleRuleY + 4,
      contentW,
      'center',
    );
    doc
      .moveTo(L, titleRuleY + 20)
      .lineTo(R, titleRuleY + 20)
      .lineWidth(LAYOUT.line)
      .stroke();

    let y = titleRuleY + 30;
      // No package, still give adequate spacing after title
      y += 6;
    
    // Meta left / right
    const metaY = y;
    const midX = L + contentW * 0.52;

    doc.font('Helvetica-Bold').fontSize(9);
    writeLineClamped(doc, 'Receipt #:', L, metaY, 68, 'left');
    writeLineClamped(doc, 'Date:', L, metaY + 12, 68, 'left');
    writeLineClamped(doc, 'Method:', L, metaY + 24, 68, 'left');
    writeLineClamped(doc, 'Processed By:', L, metaY + 36, 68, 'left');

    doc.font('Helvetica').fontSize(9);
    writeLineClamped(
      doc,
      safe(data.receipt.number),
      L + 68,
      metaY,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      formatDate(data.receipt.date),
      L + 68,
      metaY + 12,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.receipt.paymentMethod),
      L + 68,
      metaY + 24,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.receipt.processedBy),
      L + 68,
      metaY + 36,
      140,
      'left',
    );

    doc.font('Helvetica-Bold').fontSize(9);
    writeLineClamped(doc, 'Received From:', midX, metaY, 100, 'left');
    doc.font('Helvetica').fontSize(9);
    writeLineClamped(
      doc,
      safe(data.customer.name),
      midX,
      metaY + 12,
      contentW - (midX - L),
      'left',
    );
    writeLineClamped(
      doc,
      `Customer Code: ${safe(data.customer.code)}`,
      midX,
      metaY + 24,
      contentW - (midX - L),
      'left',
    );
    writeLineClamped(
      doc,
      `Contact: ${safe(data.customer.phone)}`,
      midX,
      metaY + 36,
      contentW - (midX - L),
      'left',
    );

    // Amount box (no border)
    const boxW = 210;
    const boxH = 38;
    const boxX = L + (contentW - boxW) / 2;
    const boxY = metaY + 54; // Increased from 42 to account for extra row
    doc.font('Helvetica-Bold').fontSize(13);
    writeLineClamped(
      doc,
      `Amount Paid: ${safe(data.payment.currency).toUpperCase()} ${fmt(data.payment.currency === 'GHS' ? data.payment.localAmount : data.payment.amount)}`,
      boxX,
      boxY + 6,
      boxW,
      'center',
    );

    // Amount in words
    const toWords = new ToWords({
      localeCode: data.payment.currency === 'GHS' ? 'en-GH' : 'en-US',
      converterOptions: {
        currency: true,
        ignoreDecimal: false,
        doNotAddOnly: false,
      },
    });
    const amountInWords = toWords.convert(
      data.payment.currency === 'GHS'
        ? data.payment.localAmount
        : data.payment.amount,
    );
    doc.font('Helvetica-Oblique').fontSize(12);
    writeTextWrapped(
      doc,
      `(${amountInWords})`,
      boxX,
      boxY + 22,
      boxW,
      'center',
    );

    // Applied invoices
    y = boxY + boxH + 8;
    const rowH = 11;
    const bottomReserved = 26; // footer
    let maxY = H - doc.page.margins.bottom - bottomReserved;
    doc.font('Helvetica').fontSize(8);

    if (data.invoices?.length) {
      doc.font('Helvetica-Bold').fontSize(10);
      writeLineClamped(doc, 'Applied to Invoices:', L, y, 140, 'left');
      y += 14;

      doc.font('Helvetica').fontSize(9);
      for (let i = 0; i < data.invoices.length; i++) {
        const inv = data.invoices[i];

        // Calculate height needed
        let heightNeeded = rowH;
        if ((inv as any).packingListName || (inv as any).packageCount) {
          heightNeeded += rowH;
        }

        // Check if we need a new page
        if (y + heightNeeded > maxY) {
          doc.addPage();
          // Reset y to top, perhaps with a continued header
          y = LAYOUT.topY;
          maxY = H - doc.page.margins.bottom - bottomReserved;
          // Optional: add continued header
          doc.font('Helvetica-Bold').fontSize(10);
          writeLineClamped(doc, 'Applied to Invoices (continued):', L, y, 200, 'left');
          y += 14;
          doc.font('Helvetica').fontSize(9);
        }

        // First line: Invoice number with amounts
        const line = `Invoice ${safe(inv.number)} | Total: USD ${fmt(inv.total)} | Paid: USD ${fmt(inv.paid)} | Balance: USD ${fmt(inv.balance)}`;
        writeLineClamped(doc, line, L, y, contentW, 'left');
        y += rowH;

        // Second line: Packing list and package details (if available)
        if ((inv as any).packingListName || (inv as any).packageCount || (inv as any).package?.trackingCode || (inv as any).package?.pickupCode) {
          doc.font('Helvetica').fontSize(8).fillColor('#666');
          const detailParts: string[] = [];
          if ((inv as any).packingListName) {
            detailParts.push(`Packing List: ${(inv as any).packingListName}`);
          }
          if ((inv as any).packageCount) {
            detailParts.push(`Quantity: ${(inv as any).packageCount}`);
          }
          if ((inv as any).package?.trackingCode) {
            detailParts.push(`Tracking: ${(inv as any).package.trackingCode}`);
          }
          if ((inv as any).package?.pickupCode) {
            detailParts.push(`Pickup: ${(inv as any).package.pickupCode}`);
          }
          writeLineClamped(
            doc,
            `  ${detailParts.join(' | ')}`,
            L + 10,
            y,
            contentW - 10,
            'left',
          );
          doc.fillColor('#000'); // Reset color
          y += rowH;
        }
      }
    }

    // Notes (single-line clamp if space)
    if (safe(data.notes) && y + 12 <= maxY) {
      doc.font('Helvetica-Bold').fontSize(9);
      writeLineClamped(doc, 'Notes:', L, y, 50, 'left');
      doc.font('Helvetica').fontSize(8);
      writeLineClamped(doc, safe(data.notes), L + 44, y, contentW - 44, 'left');
      y += 12;
    }

    // Footer
    doc
      .moveTo(L, H - 20)
      .lineTo(R, H - 20)
      .lineWidth(LAYOUT.line)
      .stroke();
    doc.font('Helvetica').fontSize(8);
    writeLineClamped(
      doc,
      `Generated on ${new Date().toLocaleDateString()} by AOSTP Logistics System`,
      L,
      H - 28,
      contentW,
      'center',
    );
  }

  // =====================
  // Utilities
  // =====================
  async checkFileExists(key: string): Promise<boolean> {
    return this.s3Service.fileExists(key);
  }

  async generateSignedDownloadUrl(key: string): Promise<string> {
    return this.s3Service.generatePresignedDownloadUrl(key);
  }

  /**
   * Fetch image from URL and return as buffer
   */
  private async fetchImageFromUrl(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 second timeout
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Failed to fetch image from ${url}`, error);
      throw error;
    }
  }
}
