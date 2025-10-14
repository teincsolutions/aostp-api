import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from '../storage/s3.service';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

// Base interfaces for PDF generation
export interface PDFTemplateData {
  [key: string]: any;
}

export interface PDFConfig {
  title: string;
  filename: string;
  type: 'invoice' | 'receipt' | 'packing-list' | 'package-intake-receipt';
  template: string;
  data: PDFTemplateData;
}

// Document-specific interfaces
export interface InvoiceData extends PDFTemplateData {
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  invoice: {
    number: string;
    date: string;
    dueDate: string;
    status: string;
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
}

export interface PackingListData extends PDFTemplateData {
  company: {
    name: string;
    address?: string;
  };
  packingList: {
    name: string;
    loadingDate: string;
    containerNumber?: string;
    origin?: string;
    destination?: string;
  };
  summary: {
    totalPackages: number;
    totalWeight: number;
    totalCBM: number;
  };
  customers: Array<{
    code: string;
    name: string;
    packages: Array<{
      trackingCode: string;
      description: string;
      weight: number;
      cbm?: number;
      quantity: number;
    }>;
    subtotal: {
      weight: number;
      cbm?: number;
      packages: number;
    };
  }>;
}

export interface PackageIntakeReceiptData extends PDFTemplateData {
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  receipt: {
    number: string;
    date: string;
    warehouse: string;
  };
  customer: {
    code: string;
    name: string;
    phone?: string;
    email?: string;
  };
  package: {
    trackingCode: string;
    description: string;
    shippingMode: string;
    quantity: number;
    weight?: number;
    notes?: string;
  };
  items: Array<{
    intakeTrackingCode: string;
    description: string;
    quantity: number;
    weight?: number;
  }>;
  warehouse: {
    name: string;
    location: string;
  };
}

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

  /**
   * Universal PDF generation method
   */
  async generatePDF(config: PDFConfig): Promise<{ url: string; key: string }> {
    this.logger.log(`Generating ${config.type} PDF for ${config.title}`);

    const pdfBuffer = await this.createPDF(config);

    // Create folder structure based on type
    const folderMap = {
      invoice: 'invoices',
      receipt: 'receipts',
      'packing-list': 'packing-lists',
      'package-intake-receipt': 'receipts/package-intake',
    };

    const folder = folderMap[config.type] || 'documents';
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

  /**
   * Generate invoice PDF - convenience method
   */
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

  /**
   * Generate receipt PDF - convenience method
   */
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

  /**
   * Generate packing list PDF - convenience method
   */
  async generatePackingListPDF(
    packingListData: PackingListData,
  ): Promise<{ url: string; key: string }> {
    const config: PDFConfig = {
      title: `Packing List ${packingListData.packingList.name}`,
      filename: `packing-list-${packingListData.packingList.name}`,
      type: 'packing-list',
      template: 'packing-list',
      data: packingListData,
    };
    return this.generatePDF(config);
  }

  /**
   * Generate package intake receipt PDF - convenience method
   */
  async generatePackageIntakeReceiptPDF(
    receiptData: PackageIntakeReceiptData,
  ): Promise<{ url: string; key: string }> {
    const config: PDFConfig = {
      title: `Package Intake Receipt ${receiptData.receipt.number}`,
      filename: `package-intake-receipt-${receiptData.receipt.number}`,
      type: 'package-intake-receipt',
      template: 'package-intake-receipt',
      data: receiptData,
    };
    return this.generatePDF(config);
  }

  private async createPDF(config: PDFConfig): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
      });

      const stream = new PassThrough();
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);

      doc.pipe(stream);

      try {
        // Generate content based on template type
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
      case 'packing-list':
        this.generatePackingListContent(doc, config.data as PackingListData);
        break;
      case 'package-intake-receipt':
        this.generatePackageIntakeReceiptContent(
          doc,
          config.data as PackageIntakeReceiptData,
        );
        break;
      default:
        throw new Error(`Unknown template: ${config.template}`);
    }
  }

  private generatePackageIntakeReceiptContent(
    doc: PDFDocument,
    data: PackageIntakeReceiptData,
  ): void {
    const pageWidth = 595.28 - 100; // A4 width minus margins

    // Company header
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(data.company.name, { align: 'center' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(data.company.address, { align: 'center' })
      .text(`${data.company.phone} | ${data.company.email}`, {
        align: 'center',
      })
      .moveDown(2);

    // Receipt header
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('PACKAGE INTAKE RECEIPT', { align: 'center' })
      .moveDown();

    // Receipt details and customer info side by side
    const yPosition = doc.y;

    // Left side - Receipt details
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Receipt Number:', 50, yPosition)
      .font('Helvetica')
      .text(data.receipt.number, 150, yPosition)
      .font('Helvetica-Bold')
      .text('Date:', 50, doc.y)
      .font('Helvetica')
      .text(data.receipt.date, 150, doc.y)
      .font('Helvetica-Bold')
      .text('Warehouse:', 50, doc.y)
      .font('Helvetica')
      .text(data.receipt.warehouse, 150, doc.y);

    // Right side - Customer info
    const rightCol = pageWidth / 2 + 50;
    let rightY = yPosition;

    doc.fontSize(10).font('Helvetica-Bold').text('Customer:', rightCol, rightY);

    rightY = doc.y;
    doc
      .font('Helvetica')
      .text(data.customer.name, rightCol, rightY)
      .text(`Code: ${data.customer.code}`, rightCol, doc.y);

    if (data.customer.phone) {
      doc.text(`Phone: ${data.customer.phone}`, rightCol, doc.y);
    }

    if (data.customer.email) {
      doc.text(`Email: ${data.customer.email}`, rightCol, doc.y);
    }

    doc.moveDown(3);

    // Package details
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Package Information:')
      .moveDown(0.5);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Tracking Code:', 50, doc.y)
      .font('Helvetica')
      .text(data.package.trackingCode, 150, doc.y)
      .font('Helvetica-Bold')
      .text('Description:', 50, doc.y)
      .font('Helvetica')
      .text(data.package.description, 150, doc.y)
      .font('Helvetica-Bold')
      .text('Shipping Mode:', 50, doc.y)
      .font('Helvetica')
      .text(data.package.shippingMode, 150, doc.y)
      .font('Helvetica-Bold')
      .text('Total Items:', 50, doc.y)
      .font('Helvetica')
      .text(data.package.quantity.toString(), 150, doc.y);

    if (data.package.weight) {
      doc
        .font('Helvetica-Bold')
        .text('Total Weight:', 50, doc.y)
        .font('Helvetica')
        .text(`${data.package.weight} KG`, 150, doc.y);
    }

    if (data.package.notes) {
      doc
        .font('Helvetica-Bold')
        .text('Notes:', 50, doc.y)
        .font('Helvetica')
        .text(data.package.notes, 150, doc.y);
    }

    doc.moveDown(2);

    // Items table
    if (data.items && data.items.length > 0) {
      const tableStartY = doc.y;
      const colWidths = [120, 200, 60, 60];
      const headers = ['Tracking Code', 'Description', 'Qty', 'Weight'];

      // Table headers
      doc.fontSize(10).font('Helvetica-Bold');
      let x = 50;
      headers.forEach((header, i) => {
        doc.text(header, x, tableStartY, {
          width: colWidths[i],
          align: 'left',
        });
        x += colWidths[i];
      });

      let currentY = tableStartY + 15;

      // Table rows
      doc.fontSize(9).font('Helvetica');
      data.items.forEach((item) => {
        x = 50;
        const values = [
          item.intakeTrackingCode,
          item.description,
          item.quantity.toString(),
          item.weight ? `${item.weight} KG` : 'N/A',
        ];

        values.forEach((value, i) => {
          doc.text(value, x, currentY, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        currentY += 12;
      });

      doc.y = currentY + 10;
    }

    doc.moveDown(2);

    // Acknowledgment text
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        'This receipt acknowledges that the package(s) listed above have been received at our warehouse for processing.',
        { align: 'left' },
      )
      .moveDown();

    // Warehouse info
    doc
      .font('Helvetica-Bold')
      .text('Warehouse Information:')
      .font('Helvetica')
      .text(`${data.warehouse.name}`)
      .text(`${data.warehouse.location}`)
      .moveDown(2);

    // Footer
    const footerY = 800;
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Generated on ${new Date().toLocaleDateString()} by AOSTP Logistics System`,
        50,
        footerY,
        { align: 'center', width: pageWidth },
      );
  }

  private generateInvoiceContent(
    doc: typeof PDFDocument.prototype,
    data: InvoiceData,
  ): void {
    const pageWidth = 595.28 - 100; // A4 width minus margins

    // Company header
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(data.company.name, { align: 'center' });

    if (data.company.address) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(data.company.address, { align: 'center' });
    }

    doc
      .fontSize(10)
      .text(`${data.company.phone} | ${data.company.email}`, {
        align: 'center',
      })
      .moveDown(2);

    // Invoice header
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('INVOICE', { align: 'center' })
      .moveDown();

    // Invoice details and customer info side by side
    const yPosition = doc.y;

    // Left side - Invoice details
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice Number:', 50, yPosition)
      .font('Helvetica')
      .text(data.invoice.number, 150, yPosition)
      .font('Helvetica-Bold')
      .text('Date:', 50, doc.y)
      .font('Helvetica')
      .text(data.invoice.date, 150, doc.y)
      .font('Helvetica-Bold')
      .text('Due Date:', 50, doc.y)
      .font('Helvetica')
      .text(data.invoice.dueDate, 150, doc.y);

    // Right side - Bill to
    const rightCol = pageWidth / 2 + 50;
    let rightY = yPosition;

    doc.fontSize(10).font('Helvetica-Bold').text('Bill To:', rightCol, rightY);

    rightY = doc.y;
    doc
      .font('Helvetica')
      .text(data.customer.name, rightCol, rightY)
      .text(`Customer Code: ${data.customer.code}`, rightCol, doc.y);

    if (data.customer.address) {
      doc.text(data.customer.address, rightCol, doc.y);
    }

    doc.moveDown(3);

    // Container info if present
    if (data.container) {
      doc
        .font('Helvetica-Bold')
        .text('Shipment Details:', 50, doc.y)
        .font('Helvetica')
        .text(`Container: ${data.container.number}`, 50, doc.y)
        .text(
          `Route: ${data.container.origin} → ${data.container.destination}`,
          50,
          doc.y,
        )
        .text(`Loading Date: ${data.container.loadingDate}`, 50, doc.y)
        .moveDown(2);
    }

    // Items table if present
    if (data.items && data.items.length > 0) {
      this.drawTable(doc, data.items, data.currency);
    }

    doc.moveDown(2);

    // Totals section
    const totalsY = doc.y;
    const totalsX = pageWidth - 150;

    doc
      .font('Helvetica-Bold')
      .text('TOTAL:', totalsX, totalsY)
      .text(
        `${data.currency} ${data.totals.total.toFixed(2)}`,
        totalsX + 50,
        totalsY,
        { align: 'right' },
      );

    if (data.totals.paid) {
      doc
        .text('PAID:', totalsX, doc.y)
        .text(
          `${data.currency} ${data.totals.paid.toFixed(2)}`,
          totalsX + 50,
          doc.y,
          { align: 'right' },
        );

      if (data.totals.balance && data.totals.balance > 0) {
        doc
          .text('BALANCE:', totalsX, doc.y)
          .fontSize(12)
          .text(
            `${data.currency} ${data.totals.balance.toFixed(2)}`,
            totalsX + 50,
            doc.y,
            { align: 'right' },
          );
      }
    }

    // Notes
    if (data.notes) {
      doc
        .moveDown(2)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Notes:')
        .font('Helvetica')
        .text(data.notes);
    }

    // Footer
    const footerY = 800;
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Generated on ${new Date().toLocaleDateString()} by AOSTP Logistics System`,
        50,
        footerY,
        { align: 'center', width: pageWidth },
      );
  }

  private generateReceiptContent(doc: PDFDocument, data: ReceiptData): void {
    // Similar structure to invoice but focused on payment confirmation
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(data.company.name, { align: 'center' })
      .moveDown()
      .fontSize(16)
      .text('PAYMENT RECEIPT', { align: 'center' })
      .moveDown();

    // Receipt details
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Receipt Number: ${data.receipt.number}`)
      .text(`Date: ${data.receipt.date}`)
      .text(`Payment Method: ${data.receipt.paymentMethod}`)
      .moveDown();

    // Customer info
    doc
      .font('Helvetica-Bold')
      .text('Received From:')
      .font('Helvetica')
      .text(data.customer.name)
      .text(`Customer Code: ${data.customer.code}`)
      .moveDown(2);

    // Payment amount
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(`Amount Paid: ${data.currency} ${data.payment.amount.toFixed(2)}`, {
        align: 'center',
      })
      .moveDown(2);

    // Applied to invoices
    if (data.invoices && data.invoices.length > 0) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Applied to Invoices:')
        .moveDown(0.5);

      data.invoices.forEach((invoice) => {
        doc
          .font('Helvetica')
          .text(
            `Invoice ${invoice.number} - Balance: ${data.currency} ${invoice.balance.toFixed(2)}`,
          );
      });
    }

    // Footer
    doc
      .moveDown(3)
      .fontSize(8)
      .text('Thank you for your payment!', { align: 'center' })
      .text(`Generated on ${new Date().toLocaleDateString()}`, {
        align: 'center',
      });
  }

  private generatePackingListContent(
    doc: PDFDocument,
    data: PackingListData,
  ): void {
    const pageWidth = 595.28 - 100;

    // Header
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('AOSTP LOGISTICS', { align: 'center' })
      .moveDown()
      .fontSize(16)
      .text('PACKING LIST', { align: 'center' })
      .moveDown();

    // Packing list details
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Packing List: ${data.packingList.name}`)
      .text(`Loading Date: ${data.packingList.loadingDate}`);

    if (data.packingList.containerNumber) {
      doc.text(`Container: ${data.packingList.containerNumber}`);
    }

    if (data.packingList.origin && data.packingList.destination) {
      doc.text(
        `Route: ${data.packingList.origin} → ${data.packingList.destination}`,
      );
    }

    doc.moveDown(2);

    // Summary
    doc
      .font('Helvetica-Bold')
      .text(`Total Packages: ${data.summary.totalPackages}`)
      .text(`Total Weight: ${data.summary.totalWeight} KG`)
      .text(`Total CBM: ${data.summary.totalCBM?.toFixed(2) || '0.00'}`)
      .moveDown(2);

    // Customer packages
    data.customers.forEach((customer, index) => {
      if (index > 0 && doc.y > 650) {
        doc.addPage();
      }

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${customer.name} (${customer.code})`)
        .moveDown(0.5);

      // Packages table
      const tableStartY = doc.y;
      const colWidths = [100, 150, 60, 60, 60];
      const headers = ['Tracking Code', 'Description', 'Weight', 'CBM', 'Qty'];

      // Table headers
      doc.fontSize(9).font('Helvetica-Bold');
      let x = 50;
      headers.forEach((header, i) => {
        doc.text(header, x, tableStartY, {
          width: colWidths[i],
          align: 'left',
        });
        x += colWidths[i];
      });

      let currentY = tableStartY + 15;

      // Table rows
      doc.font('Helvetica');
      customer.packages.forEach((pkg) => {
        x = 50;
        const values = [
          pkg.trackingCode,
          pkg.description,
          pkg.weight.toString(),
          pkg.cbm?.toString() || 'N/A',
          pkg.quantity.toString(),
        ];

        values.forEach((value, i) => {
          doc.text(value, x, currentY, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });
        currentY += 12;
      });

      // Subtotal
      doc.font('Helvetica-Bold');
      currentY += 5;
      x = 50;
      doc.text('Subtotal:', x, currentY, {
        width: colWidths[0] + colWidths[1],
      });
      x += colWidths[0] + colWidths[1];
      doc.text(`${customer.subtotal.weight} KG`, x, currentY, {
        width: colWidths[2],
      });
      x += colWidths[2];
      doc.text(customer.subtotal.cbm?.toFixed(2) || '0.00', x, currentY, {
        width: colWidths[3],
      });
      x += colWidths[3];
      doc.text(customer.subtotal.packages.toString(), x, currentY, {
        width: colWidths[4],
      });

      doc.moveDown(2);
    });

    // Footer
    doc
      .fontSize(8)
      .text(
        `Generated on ${new Date().toLocaleDateString()} by AOSTP Logistics System`,
        50,
        800,
        { align: 'center', width: pageWidth },
      );
  }

  /**
   * Check if file exists in S3
   */
  async checkFileExists(key: string): Promise<boolean> {
    return this.s3Service.fileExists(key);
  }

  /**
   * Generate signed download URL for file
   */
  async generateSignedDownloadUrl(key: string): Promise<string> {
    return this.s3Service.generatePresignedDownloadUrl(key);
  }

  private drawTable(
    doc: PDFDocument,
    items: InvoiceItem[],
    currency: string,
  ): void {
    const colWidths = [200, 60, 80, 80];
    const headers = ['Description', 'Quantity', 'Unit Price', 'Total'];
    const tableStartY = doc.y;

    // Table headers
    doc.fontSize(10).font('Helvetica-Bold');
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, tableStartY, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });

    let currentY = tableStartY + 15;

    // Table rows
    doc.fontSize(9).font('Helvetica');
    items.forEach((item) => {
      x = 50;
      const values = [
        item.description,
        item.quantity.toString(),
        `${currency} ${item.unitPrice.toFixed(2)}`,
        `${currency} ${item.total.toFixed(2)}`,
      ];

      values.forEach((value, i) => {
        doc.text(value, x, currentY, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });
      currentY += 12;
    });

    // Draw table border (simplified)
    doc
      .rect(
        50,
        tableStartY - 5,
        colWidths.reduce((a, b) => a + b, 0),
        currentY - tableStartY + 10,
      )
      .stroke();

    doc.y = currentY + 10;
  }
}
