import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../storage/s3.service';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { City } from '@prisma/client';

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
    destinationCity?: string;
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
}

// =====================
// Payment receipt (monochrome) + package summary
// =====================
export interface ReceiptData extends PDFTemplateData {
  receipt: {
    number: string;
    date: string;
    paymentMethod: string;
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
    currency: string;
    reference?: string;
  };
  invoices: Array<{
    number: string;
    total: number;
    paid: number;
    balance: number;
  }>;
  notes?: string;

  package?: {
    trackingCode: string;
    description?: string;
    shippingMode: 'SEA' | 'AIR';
    airType?: 'NORMAL_AIR' | 'EXPRESS_AIR' | 'BATTERY_GOODS' | 'PHONES';
    quantity: number;
    weightKg?: number;
    cbm?: number;
    destinationCity?: string;
    warehouse?: string;
    pickupCode?: string;
  };
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

// =====================
// LAYOUT CONSTANTS (tightened)
// =====================
const LAYOUT = {
  // general
  margin: 12, // was 16
  topY: 6, // header top Y
  line: 0.8,

  // header/company/date
  companyFont: 15, //
  addressFont: 8,
  dateBoxW: 80,
  dateBoxH: 14,
  dateFont: 12,

  // colored band
  bandHeight: 16, // was 20
  bandFont: 10,

  // package slab
  pkgSlabH: 30, // was 22
  pkgFont: 8,

  // table
  headH: 24, // was 18
  headFont: 8, // was 9
  rowH: 11, // was 14
  rowFont: 8, // was 9

  // totals + strips
  pillW: 130, // was 150
  pillH: 20, // was 24
  pillFont: 10,
  nbStripH: 10, // was 14
  nbFont: 7,
  bottomInfoFont: 8,

  // reserved vertical block at bottom (pill + strips area)
  bottomReserved: 64, // reduced from ~86
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
    address: string;
    phone: string;
    email: string;
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    this.bucket = this.configService.getOrThrow<string>(
      'AWS_PACKAGES_BUCKET_NAME',
    );

    // Set company info with environment variables or defaults
    this.companyInfo = {
      name: this.configService.get<string>('COMPANY_NAME') || 'AOSTP Logistics',
      address:
        this.configService.get<string>('COMPANY_ADDRESS') || 'Accra, Ghana',
      phone:
        this.configService.get<string>('COMPANY_PHONE') || '+233 XX XXX XXXX',
      email:
        this.configService.get<string>('COMPANY_EMAIL') || 'info@aostp.com',
    };
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
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A6',
        layout: 'landscape',
        margin: LAYOUT.margin,
        bufferPages: false, // do not buffer
      });

      const stream = new PassThrough();
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);

      doc.pipe(stream);

      try {
        this.generateContent(doc, config);
        doc.end();
      } catch (error: any) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private generateContent(doc: PDFDocument, config: PDFConfig): void {
    switch (config.template) {
      case 'invoice':
        this.generateInvoiceContent(doc, config.data as InvoiceData);
        break;
      case 'receipt':
        this.generateReceiptContent(doc, config.data as ReceiptData);
        break;
      case 'package-intake':
        this.generatePackageIntakeContent(
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
    const dateBoxY = LAYOUT.topY;

    // QR code placeholder (left)
    doc.rect(L, LAYOUT.topY, 44, 44).stroke();

    // Company name + logo (center)
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont).fillColor('#000');
    writeLineClamped(
      doc,
      safe(this.companyInfo.name),
      L + 40,
      LAYOUT.topY,
      contentW - 60 - LAYOUT.dateBoxW - 6,
      'center',
    );

    // Date + address (right)
    doc
      .roundedRect(dateBoxX, dateBoxY, LAYOUT.dateBoxW, LAYOUT.dateBoxH, 2)
      .fill('#E6E6E6');
    doc.fillColor('#000').fontSize(LAYOUT.dateFont).font('Helvetica-Bold');
    writeLineClamped(
      doc,
      safe(data.invoice.date),
      dateBoxX,
      dateBoxY + 3,
      LAYOUT.dateBoxW,
      'center',
    );

    // Address small (below date box)
    if (safe(this.companyInfo.address)) {
      doc.font('Helvetica').fontSize(LAYOUT.addressFont).fillColor('#000');
      writeLineClamped(
        doc,
        safe(this.companyInfo.address),
        dateBoxX - 150,
        dateBoxY + LAYOUT.dateBoxH + 4,
        130,
        'right',
      );
    }

    return dateBoxY + LAYOUT.dateBoxH + 32; // Return next Y position
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
      bandY + 3,
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
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(9);
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

    doc.font('Helvetica').fontSize(12);
    writeLineClamped(
      doc,
      `${data.customer?.name} (${data.customer?.code})`.toUpperCase(),
      L,
      customerY + 12,
      contentW * 0.5,
      'left',
    );

    return customerY + 28; // Return next Y position
  }

  private drawTitle(
    doc: PDFDocument,
    data: InvoiceData,
    contentW: number,
    L: number,
    titleY: number,
  ): number {
    // Package strip
    const pkg = data.package;
    if (pkg) {
      doc.rect(L, titleY, contentW, LAYOUT.pkgSlabH).fill('#F6F6F6');
      const chips: string[] = [];
      if (safe(pkg.trackingCode))
        chips.push(`TCODE: ${safe(pkg.trackingCode)}`);
      if (pkg.shippingMode === 'AIR') {
        const t = pkg.airType || 'NORMAL_AIR';
        chips.push(`MODE: AIR / ${t.replace('_', ' ')}`);
        if (safe(pkg.pickupCode)) chips.push(`PCODE: ${pkg.pickupCode}`);
      } else if (pkg.shippingMode === 'SEA') {
        chips.push('MODE: SEA');
      }
      if (safe(pkg.destinationCity)) chips.push(`DEST: ${pkg.destinationCity}`);
      if (safe(pkg.warehouse)) chips.push(`WH: ${pkg.warehouse}`);

      doc.fillColor('#000').font('Helvetica-Bold').fontSize(LAYOUT.pkgFont);
      writeLineClamped(
        doc,
        chips.join(' • '),
        L + 5,
        titleY + 4,
        contentW - 10,
        'left',
      );
      return titleY + LAYOUT.pkgSlabH + 4; // Return next Y position
    }
    return titleY; // Return same Y if no package
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
        label: `AMOUNT (${currency})`,
        align: 'right' as const,
      },
    ];
    cols.forEach((c) =>
      writeLineClamped(doc, c.label, c.x, headY + 5, c.w, c.align),
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
            description: `${item.description}\n${data.package?.trackingCode ? ` ${data.package.trackingCode}` : ''}`,
          }))
        : [
            {
              description: `${data.package?.description || ''}\n${data.package?.pickupCode ? `Pickup Code: ${data.package.pickupCode}` : ''}`,
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
      writeLineClamped(
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
      y += LAYOUT.rowH;
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
    const pillY = H - 66;
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
      pillY + 4,
      LAYOUT.pillW - 16,
      'center',
    );

    // NB strip
    const nbY = H - 36;
    doc.rect(L, nbY, contentW, LAYOUT.nbStripH).fill(theme.nbStrip);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(LAYOUT.nbFont);
    writeLineClamped(
      doc,
      `NB: ETA values are estimates and can be affected by unforeseen circumstances.`,
      L + 5,
      nbY + 2,
      contentW - 10,
      'left',
    );

    // Arrival / MoMo strip (single line)
    const bottomY = nbY + LAYOUT.nbStripH + 2;
    doc
      .font('Helvetica-Bold')
      .fontSize(LAYOUT.bottomInfoFont)
      .fillColor('#000');
    const phone = safe(data.company.phone);
    writeLineClamped(
      doc,
      phone ? `MOMO: ${phone}` : `MOMO:`,
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
      `${label} ${safe(data.invoice?.dueDate)}`,
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
  // PACKAGE INTAKE (A6, monochrome) — single-page fit
  // =====================
  private generatePackageIntakeContent(
    doc: PDFDocument,
    data: PackageIntakeData,
  ): void {
    const W = doc.page.width;
    const H = doc.page.height;
    const L = doc.page.margins.left;
    const R = W - doc.page.margins.right;
    const contentW = R - L;

    doc.fillColor('#000');

    // Header
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont);
    writeLineClamped(
      doc,
      safe(this.companyInfo.name),
      L,
      LAYOUT.topY,
      contentW,
      'center',
    );
    doc.fontSize(11).font('Helvetica');
    writeLineClamped(
      doc,
      safe(this.companyInfo.address),
      L,
      LAYOUT.topY + 16,
      contentW,
      'center',
    );
    writeLineClamped(
      doc,
      `${safe(this.companyInfo.phone)} | ${safe(this.companyInfo.email)}`,
      L,
      LAYOUT.topY + 30,
      contentW,
      'center',
    );

    // Title rule + title
    doc.moveTo(L, 56).lineTo(R, 56).lineWidth(LAYOUT.line).stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    writeLineClamped(doc, 'PACKAGE INTAKE RECEIPT', L, 60, contentW, 'center');
    doc.moveTo(L, 76).lineTo(R, 76).lineWidth(LAYOUT.line).stroke();

    // Two columns meta
    const metaY = 82;
    const midX = L + contentW * 0.52;

    doc.font('Helvetica-Bold').fontSize(9);
    writeLineClamped(doc, 'Intake Code:', L, metaY, 72, 'left');
    writeLineClamped(doc, 'Date:', L, metaY + 12, 72, 'left');
    writeLineClamped(doc, 'Warehouse:', L, metaY + 24, 72, 'left');

    doc.font('Helvetica').fontSize(9);
    writeLineClamped(
      doc,
      safe(data.intake.trackingCode),
      L + 60,
      metaY,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.intake.date),
      L + 60,
      metaY + 12,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.intake.warehouse),
      L + 60,
      metaY + 24,
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
    const boxH = 54;
    const boxY = metaY + 54;
    doc.roundedRect(L, boxY, boxW, boxH, 3).stroke();

    let py = boxY + 8;
    doc.font('Helvetica-Bold').fontSize(10);
    writeLineClamped(doc, 'PACKAGE DETAILS', L + 8, py, boxW - 16, 'left');
    py += 14;

    doc.font('Helvetica').fontSize(8);
    writeLineClamped(
      doc,
      `Description: ${safe(data.package.description)} • Mode: ${data.package.shippingMode}${data.package.airType ? ` / ${data.package.airType.replace('_', ' ')}` : ''}`,
      L + 8,
      py,
      boxW - 16,
      'left',
    );
    py += 11;

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
      H - 20,
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
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont);
    writeLineClamped(
      doc,
      safe(this.companyInfo.name),
      L,
      LAYOUT.topY,
      contentW,
      'center',
    );
    doc.fontSize(11).font('Helvetica');
    writeLineClamped(
      doc,
      safe(this.companyInfo.address),
      L,
      LAYOUT.topY + 16,
      contentW,
      'center',
    );
    writeLineClamped(
      doc,
      `${safe(this.companyInfo.phone)} | ${safe(this.companyInfo.email)}`,
      L,
      LAYOUT.topY + 30,
      contentW,
      'center',
    );

    // Title rule + title
    doc.moveTo(L, 56).lineTo(R, 56).lineWidth(LAYOUT.line).stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    writeLineClamped(doc, 'PAYMENT RECEIPT', L, 60, contentW, 'center');
    doc.moveTo(L, 76).lineTo(R, 76).lineWidth(LAYOUT.line).stroke();

    // PACKAGE summary slab
    const pkg = data.package;
    let y = 82;
    if (pkg) {
      const slabH = 18;
      doc
        .rect(L, y, contentW, slabH)
        .strokeColor('#000')
        .lineWidth(LAYOUT.line)
        .stroke();

      const chips: string[] = [];
      if (safe(pkg.trackingCode))
        chips.push(`TCODE: ${safe(pkg.trackingCode)}`);
      if (pkg.shippingMode === 'AIR') {
        const t = pkg.airType || 'NORMAL_AIR';
        chips.push(`MODE: AIR / ${t.replace('_', ' ')}`);
      } else if (pkg.shippingMode === 'SEA') {
        chips.push('MODE: SEA');
      }
      chips.push(`QTY: ${pkg.quantity}`);
      if (pkg.weightKg != null) chips.push(`WT: ${pkg.weightKg} KG`);
      if (pkg.cbm != null) chips.push(`CBM: ${pkg.cbm}`);
      if (safe(pkg.destinationCity)) chips.push(`DEST: ${pkg.destinationCity}`);
      if (safe(pkg.warehouse)) chips.push(`WH: ${pkg.warehouse}`);

      doc.font('Helvetica-Bold').fontSize(8);
      writeLineClamped(
        doc,
        chips.join(' • '),
        L + 5,
        y + 3,
        contentW - 10,
        'left',
      );
      y += slabH + 6;
    } else {
      y = 84;
    }

    // Meta left / right
    const metaY = y;
    const midX = L + contentW * 0.52;

    doc.font('Helvetica-Bold').fontSize(9);
    writeLineClamped(doc, 'Receipt #:', L, metaY, 68, 'left');
    writeLineClamped(doc, 'Date:', L, metaY + 12, 68, 'left');
    writeLineClamped(doc, 'Method:', L, metaY + 24, 68, 'left');

    doc.font('Helvetica').fontSize(9);
    writeLineClamped(
      doc,
      safe(data.receipt.number),
      L + 66,
      metaY,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.receipt.date),
      L + 66,
      metaY + 12,
      140,
      'left',
    );
    writeLineClamped(
      doc,
      safe(data.receipt.paymentMethod),
      L + 66,
      metaY + 24,
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

    // Amount box
    const boxW = 210;
    const boxH = 26;
    const boxX = L + (contentW - boxW) / 2;
    const boxY = metaY + 42;
    doc.roundedRect(boxX, boxY, boxW, boxH, 3).stroke();
    doc.font('Helvetica-Bold').fontSize(11);
    writeLineClamped(
      doc,
      `Amount Paid: ${safe(data.payment.currency).toUpperCase()} ${fmt(data.payment.amount)}`,
      boxX,
      boxY + 6,
      boxW,
      'center',
    );

    // Applied invoices — height limited
    y = boxY + boxH + 8;
    const rowH = 11;
    const bottomReserved = 26; // footer
    const maxY = H - doc.page.margins.bottom - bottomReserved;
    doc.font('Helvetica').fontSize(8);

    if (data.invoices?.length) {
      doc.font('Helvetica-Bold').fontSize(10);
      writeLineClamped(doc, 'Applied to Invoices:', L, y, 140, 'left');
      y += 14;

      const spaceRows = Math.max(0, Math.floor((maxY - y) / rowH));
      const showCount = Math.min(spaceRows, data.invoices.length);
      const overflow = data.invoices.length - showCount;

      doc.font('Helvetica').fontSize(9);
      for (let i = 0; i < showCount; i++) {
        const inv = data.invoices[i];
        const line = `Invoice ${safe(inv.number)} | Total: ${safe(data.payment.currency).toUpperCase()} ${fmt(inv.total)} | Paid: ${fmt(inv.paid)} | Balance: ${fmt(inv.balance)}`;
        writeLineClamped(doc, line, L, y, contentW, 'left');
        y += rowH;
      }

      if (overflow > 0 && y <= maxY) {
        doc.font('Helvetica-Oblique').fontSize(9);
        writeLineClamped(
          doc,
          `(+${overflow} more invoices)`,
          L,
          y,
          contentW,
          'left',
        );
        y += rowH;
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
      H - 26,
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
}
