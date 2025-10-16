import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../storage/s3.service';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

// =====================
// Base interfaces
// =====================
export interface PDFTemplateData {
  [key: string]: any;
}

export interface PDFConfig {
  title: string;
  filename: string;
  type: 'invoice' | 'receipt'; // storage folder only
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

  // optional pass-through for theming:
  // shippingMode?: 'SEA' | 'AIR';
  // airType?: 'NORMAL_AIR' | 'EXPRESS_AIR' | 'BATTERY_GOODS' | 'PHONES';
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
    destinationCity?: string;
  };
  notes?: string;
}

// =====================
// Payment receipt (monochrome) + package summary
// =====================
export interface ReceiptData extends PDFTemplateData {
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
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

// Single-line, width-clamped with ellipsis; never wraps vertically
function line(
  doc: PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'center' | 'right' = 'left',
) {
  let s = text ?? '';
  while (doc.widthOfString(s) > width && s.length > 1) s = s.slice(0, -1);
  if (s !== text && width >= doc.widthOfString('…')) {
    while (doc.widthOfString(s + '…') > width && s.length > 1)
      s = s.slice(0, -1);
    s += '…';
  }
  doc.text(s, x, y, { width, align, lineBreak: false });
}

// =====================
// LAYOUT CONSTANTS (tightened and spaced to avoid collisions)
// =====================
const LAYOUT = {
  margin: 12,

  // header
  companyFont: 15,
  addressFont: 8,
  topY: 8,
  dateBoxW: 108,
  dateBoxH: 18,
  dateFont: 10,

  // band
  bandH: 16,
  bandFont: 10,

  // package
  pkgH: 18,
  pkgFont: 8,

  // customer block
  custLabelFont: 9,
  custValueFont: 11,

  // table
  headH: 14,
  headFont: 8,
  rowH: 11,
  rowFont: 8,

  // bottom widgets
  pillW: 130,
  pillH: 20,
  pillFont: 10,
  nbH: 10,
  nbFont: 7,
  bottomFont: 8,

  // separations
  gapXS: 2,
  gapS: 4,
  gapM: 6,
  gapL: 8,

  // reserve bottom area (pill + NB + info)
  bottomReserved: 66,
};

// =====================
// Service
// =====================
@Injectable()
export class PDFService {
  private readonly logger = new Logger(PDFService.name);
  private readonly bucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly s3Service: S3Service,
  ) {
    this.bucket = this.configService.getOrThrow<string>(
      'AWS_PACKAGES_BUCKET_NAME',
    );
  }

  // --------- Public API ---------
  async generatePDF(config: PDFConfig): Promise<{ url: string; key: string }> {
    this.logger.log(`Generating ${config.type} PDF for ${config.title}`);

    const pdfBuffer = await this.createPDF(config);

    const folderMap = { invoice: 'invoices', receipt: 'receipts' } as const;
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
        bufferPages: false,
      });

      const stream = new PassThrough();
      stream.on('data', (c) => chunks.push(c));
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
        throw new Error(`Unknown template: ${config.template}`);
    }
  }

  // =====================
  // INVOICE — A6, single-page, clear spacing
  // =====================
  private generateInvoiceContent(doc: PDFDocument, data: InvoiceData): void {
    const W = doc.page.width;
    const H = doc.page.height;
    const Lm = doc.page.margins.left;
    const Rm = W - doc.page.margins.right;
    const contentW = Rm - Lm;

    const theme = THEMES[resolveThemeFromData(data)];
    const currency = (data.currency || theme.currencyFallback).toUpperCase();

    // --- Header row: company (left) / date box (right) ---
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont).fillColor('#000');
    line(
      doc,
      safe(data.company.name),
      Lm,
      LAYOUT.topY,
      contentW - LAYOUT.dateBoxW - LAYOUT.gapM,
      'left',
    );

    const dateX = Rm - LAYOUT.dateBoxW;
    const dateY = LAYOUT.topY;
    doc
      .roundedRect(dateX, dateY, LAYOUT.dateBoxW, LAYOUT.dateBoxH, 2)
      .fill('#E6E6E6');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(LAYOUT.dateFont);
    line(
      doc,
      safe(data.invoice.date),
      dateX,
      dateY + 3,
      LAYOUT.dateBoxW,
      'center',
    );

    // address (right aligned, single line)
    if (safe(data.company.address)) {
      doc.font('Helvetica').fontSize(LAYOUT.addressFont).fillColor('#000');
      line(
        doc,
        safe(data.company.address),
        Lm,
        dateY + LAYOUT.dateBoxH + LAYOUT.gapXS,
        contentW,
        'right',
      );
    }

    // --- Band row ---
    const bandY = dateY + LAYOUT.dateBoxH + LAYOUT.gapM;
    doc.rect(Lm, bandY, contentW, LAYOUT.bandH).fill(theme.band);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(LAYOUT.bandFont);
    line(doc, theme.bandLabel, Lm + 6, bandY + 3, contentW - 12, 'center');

    // --- Package strip ---
    const pkg = data.package;
    const pkgY = bandY + LAYOUT.bandH + LAYOUT.gapS;
    if (pkg) {
      doc.rect(Lm, pkgY, contentW, LAYOUT.pkgH).fill('#F6F6F6');
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

      doc.fillColor('#000').font('Helvetica-Bold').fontSize(LAYOUT.pkgFont);
      line(doc, chips.join(' • '), Lm + 5, pkgY + 4, contentW - 10, 'left');
    }

    // --- Customer block (labels on line 1; values on line 2) ---
    const custY =
      (pkg ? pkgY + LAYOUT.pkgH : bandY + LAYOUT.bandH) + LAYOUT.gapM;
    doc.font('Helvetica-Bold').fontSize(LAYOUT.custLabelFont).fillColor('#000');
    line(doc, 'CUSTOMER:', Lm, custY, contentW * 0.5 - 8, 'left');
    line(
      doc,
      'CONTACT:',
      Lm + contentW * 0.5 + 8,
      custY,
      contentW * 0.5 - 8,
      'left',
    );

    doc.font('Helvetica').fontSize(LAYOUT.custValueFont);
    line(
      doc,
      (data.customer?.name || '').toUpperCase(),
      Lm,
      custY + LAYOUT.gapM,
      contentW * 0.5 - 8,
      'left',
    );
    const contact =
      data.customer?.phone || data.customer?.email || data.customer?.code || '';
    line(
      doc,
      contact,
      Lm + contentW * 0.5 + 8,
      custY + LAYOUT.gapM,
      contentW * 0.5 - 8,
      'left',
    );

    // divider
    const divY = custY + LAYOUT.gapM + LAYOUT.custValueFont;
    doc
      .moveTo(Lm, divY)
      .lineTo(Rm, divY)
      .lineWidth(0.8)
      .strokeColor('#CCC')
      .stroke();

    // --- Table header (short labels to avoid wrapping) ---
    const headY = divY + LAYOUT.gapS;
    doc.rect(Lm, headY, contentW, LAYOUT.headH).fill(theme.tableHeadBg);
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(LAYOUT.headFont);

    const cols = [
      {
        x: Lm + 6,
        w: contentW * 0.48,
        label: 'DESCRIPTION',
        align: 'left' as const,
      },
      {
        x: Lm + contentW * 0.48 + 6,
        w: contentW * 0.12,
        label: 'QTY',
        align: 'center' as const,
      },
      {
        x: Lm + contentW * 0.6 + 6,
        w: contentW * 0.16,
        label: `UNIT ${currency}`,
        align: 'right' as const,
      },
      {
        x: Lm + contentW * 0.76 + 6,
        w: contentW * 0.24 - 12,
        label: `AMOUNT ${currency}`,
        align: 'right' as const,
      },
    ];
    cols.forEach((c) => line(doc, c.label, c.x, headY + 2, c.w, c.align));

    // --- Rows (fit to page) ---
    let y = headY + LAYOUT.headH + LAYOUT.gapXS;
    const maxY = H - doc.page.margins.bottom - LAYOUT.bottomReserved;
    const rows: InvoiceItem[] =
      (data.items?.length ?? 0) > 0
        ? data.items!
        : [
            {
              description:
                data.package?.description ||
                (data.package
                  ? `Shipping for ${data.package.trackingCode}`
                  : 'Logistics service'),
              quantity: data.package?.quantity ?? 1,
              unitPrice:
                (data.totals?.total ?? 0) / (data.package?.quantity ?? 1),
              total: data.totals?.total ?? 0,
            },
          ];

    const capacity = Math.max(0, Math.floor((maxY - y) / LAYOUT.rowH));
    const show = Math.min(rows.length, capacity);
    const more = rows.length - show;

    doc.font('Helvetica').fontSize(LAYOUT.rowFont).fillColor('#000');
    for (let i = 0; i < show; i++) {
      const it = rows[i];
      line(doc, it.description || '', cols[0].x, y, cols[0].w, 'left');
      line(doc, String(it.quantity ?? 0), cols[1].x, y, cols[1].w, 'center');
      line(doc, fmt(it.unitPrice ?? 0), cols[2].x, y, cols[2].w, 'right');
      line(doc, fmt(it.total ?? 0), cols[3].x, y, cols[3].w, 'right');
      y += LAYOUT.rowH;
    }
    if (more > 0 && y <= maxY) {
      doc.font('Helvetica-Oblique').fontSize(LAYOUT.rowFont);
      line(doc, `(+${more} more items)`, cols[0].x, y, contentW - 12, 'left');
      y += LAYOUT.rowH;
    }

    // --- Totals pill (bottom-right) ---
    const pillX = Rm - LAYOUT.pillW;
    const pillY = H - 58;
    doc
      .roundedRect(pillX, pillY, LAYOUT.pillW, LAYOUT.pillH, 3)
      .fill(theme.totalsBg);
    doc
      .fillColor(theme.totalsFg)
      .font('Helvetica-Bold')
      .fontSize(LAYOUT.pillFont);
    line(
      doc,
      `${currency} ${fmt(data.totals.total)}`,
      pillX + 8,
      pillY + 4,
      LAYOUT.pillW - 16,
      'center',
    );

    // --- NB strip (own row) ---
    const nbY = H - 36;
    doc.rect(Lm, nbY, contentW, LAYOUT.nbH).fill(theme.nbStrip);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(LAYOUT.nbFont);
    line(
      doc,
      'NB: ETA values are estimates and can be affected by unforeseen circumstances.',
      Lm + 5,
      nbY + 2,
      contentW - 10,
      'left',
    );

    // --- Bottom info: two distinct rows so they never merge ---
    const infoY1 = nbY + LAYOUT.nbH + LAYOUT.gapXS;
    doc.font('Helvetica-Bold').fontSize(LAYOUT.bottomFont).fillColor('#000');
    const phone = safe(data.company.phone);
    line(
      doc,
      phone ? `MOMO: ${phone}` : 'MOMO:',
      Lm,
      infoY1,
      contentW * 0.5 - 6,
      'left',
    );
    const label =
      resolveThemeFromData(data) === 'SEA' ||
      resolveThemeFromData(data) === 'AIR_EXPRESS'
        ? 'EST. ARRIVAL:'
        : 'ARRIVAL:';
    line(
      doc,
      `${label} ${safe(data.invoice.dueDate)}`,
      Lm + contentW * 0.5 + 6,
      infoY1,
      contentW * 0.5 - 6,
      'right',
    );

    // Optional tiny pickup hint (fits on one line, below infoY1)
    const infoY2 = infoY1 + LAYOUT.gapS + 6;
    doc.font('Helvetica').fontSize(7);
    line(
      doc,
      `For pick up, kindly contact the warehouse on: ${phone || '—'}`,
      Lm,
      infoY2,
      contentW,
      'center',
    );
  }

  // =====================
  // PACKAGE INTAKE — A6, monochrome, single-page
  // =====================
  private generatePackageIntakeContent(
    doc: PDFDocument,
    data: PackageIntakeData,
  ): void {
    const W = doc.page.width;
    const H = doc.page.height;
    const Lm = doc.page.margins.left;
    const Rm = W - doc.page.margins.right;
    const contentW = Rm - Lm;

    doc.fillColor('#000');

    // Header
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont);
    line(doc, safe(data.company.name), Lm, LAYOUT.topY, contentW, 'center');
    doc.font('Helvetica').fontSize(10);
    line(
      doc,
      safe(data.company.address),
      Lm,
      LAYOUT.topY + 14,
      contentW,
      'center',
    );
    line(
      doc,
      `${safe(data.company.phone)} | ${safe(data.company.email)}`,
      Lm,
      LAYOUT.topY + 26,
      contentW,
      'center',
    );

    // Title
    const ruleY = 54;
    doc
      .moveTo(Lm, ruleY)
      .lineTo(Rm, ruleY)
      .strokeColor('#000')
      .lineWidth(0.8)
      .stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    line(doc, 'PACKAGE INTAKE RECEIPT', Lm, ruleY + 4, contentW, 'center');
    doc
      .moveTo(Lm, ruleY + 18)
      .lineTo(Rm, ruleY + 18)
      .strokeColor('#000')
      .lineWidth(0.6)
      .stroke();

    // Meta two-columns
    const metaY = ruleY + 24;
    const midX = Lm + contentW * 0.52;

    doc.font('Helvetica-Bold').fontSize(9);
    line(doc, 'Intake Code:', Lm, metaY, 76, 'left');
    line(doc, 'Date:', Lm, metaY + 12, 76, 'left');
    line(doc, 'Warehouse:', Lm, metaY + 24, 76, 'left');

    doc.font('Helvetica').fontSize(9);
    line(doc, safe(data.intake.trackingCode), Lm + 70, metaY, 140, 'left');
    line(doc, safe(data.intake.date), Lm + 70, metaY + 12, 140, 'left');
    line(doc, safe(data.intake.warehouse), Lm + 70, metaY + 24, 140, 'left');

    doc.font('Helvetica-Bold').fontSize(9);
    line(doc, 'Customer:', midX, metaY, 70, 'left');
    doc.font('Helvetica').fontSize(9);
    line(
      doc,
      safe(data.customer.name),
      midX + 58,
      metaY,
      contentW - (midX + 58 - Lm),
      'left',
    );
    line(
      doc,
      `Code: ${safe(data.customer.code)}`,
      midX,
      metaY + 12,
      contentW - (midX - Lm),
      'left',
    );
    line(
      doc,
      safe(data.customer.phone),
      midX,
      metaY + 24,
      contentW - (midX - Lm),
      'left',
    );
    if (safe(data.customer.email)) {
      line(
        doc,
        safe(data.customer.email),
        midX,
        metaY + 36,
        contentW - (midX - Lm),
        'left',
      );
    }

    // Package box
    const boxY = metaY + 52;
    const boxH = 52;
    doc.roundedRect(Lm, boxY, contentW, boxH, 3).stroke();

    let py = boxY + 8;
    doc.font('Helvetica-Bold').fontSize(10);
    line(doc, 'PACKAGE DETAILS', Lm + 8, py, contentW - 16, 'left');
    py += 14;

    doc.font('Helvetica').fontSize(8);
    line(
      doc,
      `Description: ${safe(data.package.description)} • Mode: ${data.package.shippingMode}${data.package.airType ? ` / ${data.package.airType.replace('_', ' ')}` : ''}`,
      Lm + 8,
      py,
      contentW - 16,
      'left',
    );
    py += 11;
    line(
      doc,
      `Qty: ${data.package.quantity} • Weight: ${data.package.weightKg || 0} KG${data.package.cbm ? ` • CBM: ${data.package.cbm}` : ''}${data.package.destinationCity ? ` • Dest: ${data.package.destinationCity}` : ''}`,
      Lm + 8,
      py,
      contentW - 16,
      'left',
    );

    // Notes (single-line)
    const notesY = boxY + boxH + LAYOUT.gapS;
    if (safe(data.notes)) {
      doc.font('Helvetica-Bold').fontSize(9);
      line(doc, 'Notes:', Lm, notesY, 40, 'left');
      doc.font('Helvetica').fontSize(8);
      line(doc, safe(data.notes), Lm + 40, notesY, contentW - 40, 'left');
    }

    // Footer
    const footRuleY = H - 22;
    doc
      .moveTo(Lm, footRuleY)
      .lineTo(Rm, footRuleY)
      .strokeColor('#000')
      .lineWidth(0.6)
      .stroke();
    doc.font('Helvetica').fontSize(8);
    line(
      doc,
      `Generated on ${new Date().toLocaleDateString()} by AOSTP Logistics System`,
      Lm,
      footRuleY + 6,
      contentW,
      'center',
    );
  }

  // =====================
  // RECEIPT — A6, monochrome, single-page
  // =====================
  private generateReceiptContent(doc: PDFDocument, data: ReceiptData): void {
    const W = doc.page.width;
    const H = doc.page.height;
    const Lm = doc.page.margins.left;
    const Rm = W - doc.page.margins.right;
    const contentW = Rm - Lm;

    doc.fillColor('#000');

    // Header
    doc.font('Helvetica-Bold').fontSize(LAYOUT.companyFont);
    line(doc, safe(data.company.name), Lm, LAYOUT.topY, contentW, 'center');
    doc.font('Helvetica').fontSize(10);
    line(
      doc,
      safe(data.company.address),
      Lm,
      LAYOUT.topY + 14,
      contentW,
      'center',
    );
    line(
      doc,
      `${safe(data.company.phone)} | ${safe(data.company.email)}`,
      Lm,
      LAYOUT.topY + 26,
      contentW,
      'center',
    );

    // Title
    const ruleY = 54;
    doc
      .moveTo(Lm, ruleY)
      .lineTo(Rm, ruleY)
      .strokeColor('#000')
      .lineWidth(0.8)
      .stroke();
    doc.font('Helvetica-Bold').fontSize(12);
    line(doc, 'PAYMENT RECEIPT', Lm, ruleY + 4, contentW, 'center');
    doc
      .moveTo(Lm, ruleY + 18)
      .lineTo(Rm, ruleY + 18)
      .strokeColor('#000')
      .lineWidth(0.6)
      .stroke();

    // Package summary
    const pkg = data.package;
    let y = ruleY + 22;
    if (pkg) {
      const slabH = 18;
      doc
        .rect(Lm, y, contentW, slabH)
        .strokeColor('#000')
        .lineWidth(0.6)
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
      line(doc, chips.join(' • '), Lm + 5, y + 3, contentW - 10, 'left');
      y += slabH + LAYOUT.gapS;
    }

    // Meta two-columns (labels then values)
    const metaY = y;
    const midX = Lm + contentW * 0.52;

    doc.font('Helvetica-Bold').fontSize(9);
    line(doc, 'Receipt #:', Lm, metaY, 70, 'left');
    line(doc, 'Date:', Lm, metaY + 12, 70, 'left');
    line(doc, 'Method:', Lm, metaY + 24, 70, 'left');

    doc.font('Helvetica').fontSize(9);
    line(doc, safe(data.receipt.number), Lm + 68, metaY, 140, 'left');
    line(doc, safe(data.receipt.date), Lm + 68, metaY + 12, 140, 'left');
    line(
      doc,
      safe(data.receipt.paymentMethod),
      Lm + 68,
      metaY + 24,
      140,
      'left',
    );

    doc.font('Helvetica-Bold').fontSize(9);
    line(doc, 'Received From:', midX, metaY, 100, 'left');
    doc.font('Helvetica').fontSize(9);
    line(
      doc,
      safe(data.customer.name),
      midX,
      metaY + 12,
      contentW - (midX - Lm),
      'left',
    );
    line(
      doc,
      `Customer Code: ${safe(data.customer.code)}`,
      midX,
      metaY + 24,
      contentW - (midX - Lm),
      'left',
    );

    // Amount box
    const boxW = 210;
    const boxH = 26;
    const boxX = Lm + (contentW - boxW) / 2;
    const boxY = metaY + 42;
    doc.roundedRect(boxX, boxY, boxW, boxH, 3).stroke();
    doc.font('Helvetica-Bold').fontSize(11);
    line(
      doc,
      `Amount Paid: ${safe(data.payment.currency).toUpperCase()} ${fmt(data.payment.amount)}`,
      boxX,
      boxY + 6,
      boxW,
      'center',
    );

    // Applied invoices — height limited
    y = boxY + boxH + LAYOUT.gapS;
    const rowH = 11;
    const maxY = H - doc.page.margins.bottom - 26; // footer reserve
    if (data.invoices?.length) {
      doc.font('Helvetica-Bold').fontSize(9);
      line(doc, 'Applied To:', Lm, y, 100, 'left');
      y += 12;

      const capacity = Math.max(0, Math.floor((maxY - y) / rowH));
      const show = Math.min(capacity, data.invoices.length);
      const more = data.invoices.length - show;

      doc.font('Helvetica').fontSize(8);
      for (let i = 0; i < show; i++) {
        const inv = data.invoices[i];
        const t = safe(data.payment.currency).toUpperCase();
        const lineText = `Invoice ${safe(inv.number)}  •  Total: ${t} ${fmt(inv.total)}  •  Paid: ${fmt(inv.paid)}  •  Balance: ${fmt(inv.balance)}`;
        line(doc, lineText, Lm, y, contentW, 'left');
        y += rowH;
      }
      if (more > 0 && y <= maxY) {
        doc.font('Helvetica-Oblique').fontSize(8);
        line(doc, `(+${more} more invoices)`, Lm, y, contentW, 'left');
        y += rowH;
      }
    }

    // Footer
    const footRuleY = H - 20;
    doc
      .moveTo(Lm, footRuleY)
      .lineTo(Rm, footRuleY)
      .strokeColor('#000')
      .lineWidth(0.6)
      .stroke();
    doc.font('Helvetica').fontSize(8);
    line(
      doc,
      `Generated on ${new Date().toLocaleDateString()} by AOSTP Logistics System`,
      Lm,
      footRuleY + 6,
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
