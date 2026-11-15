import { Injectable } from '@nestjs/common';
import { Customer } from '@prisma/client';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { CustomerExportFormat } from './dto/export-customers.dto';

export const CUSTOMER_EXPORT_ROW_LIMIT = 5000;

export interface CustomerExportRow extends Customer {
  warehouse: { id: string; name: string; location: string } | null;
  cityRef: { id: string; name: string; country: string } | null;
  _count: { packages: number; invoices: number; payments: number };
}

export interface CustomerExportFileInfo {
  filename: string;
  contentType: string;
}

export interface CustomerExportFile extends CustomerExportFileInfo {
  buffer: Buffer;
}

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const EXCEL_COLUMNS: Array<{
  header: string;
  key: string;
  width: number;
}> = [
  { header: 'Customer Code', key: 'customerCode', width: 18 },
  { header: 'First Name', key: 'firstName', width: 18 },
  { header: 'Last Name', key: 'lastName', width: 18 },
  { header: 'Phone Number', key: 'phoneNumber', width: 18 },
  { header: 'Alternate Phone', key: 'alternatePhone', width: 18 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Address', key: 'address', width: 32 },
  { header: 'City', key: 'city', width: 18 },
  { header: 'Country', key: 'country', width: 16 },
  { header: 'Warehouse', key: 'warehouse', width: 20 },
  { header: 'ID Type', key: 'idType', width: 18 },
  { header: 'ID Number', key: 'idNumber', width: 20 },
  { header: 'Preferred Channel', key: 'preferredChannel', width: 18 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Packages', key: 'packages', width: 12 },
  { header: 'Invoices', key: 'invoices', width: 12 },
  { header: 'Payments', key: 'payments', width: 12 },
  { header: 'Created At', key: 'createdAt', width: 14 },
];

const PDF_COLUMNS: Array<{
  header: string;
  weight: number;
  value: (row: CustomerExportRow) => string;
}> = [
  { header: 'Code', weight: 12, value: (row) => row.customerCode },
  {
    header: 'Customer Name',
    weight: 20,
    value: (row) => [row.firstName, row.lastName].filter(Boolean).join(' '),
  },
  { header: 'Phone', weight: 13, value: (row) => row.phoneNumber },
  { header: 'Email', weight: 24, value: (row) => row.email ?? '' },
  { header: 'City', weight: 12, value: (row) => row.cityRef?.name ?? '' },
  {
    header: 'Warehouse',
    weight: 15,
    value: (row) => row.warehouse?.name ?? '',
  },
  {
    header: 'Status',
    weight: 8,
    value: (row) => (row.isActive ? 'Active' : 'Inactive'),
  },
  {
    header: 'Pkgs',
    weight: 6,
    value: (row) => String(row._count?.packages ?? 0),
  },
];

function toExcelRow(row: CustomerExportRow): Record<string, unknown> {
  return {
    customerCode: row.customerCode,
    firstName: row.firstName,
    lastName: row.lastName ?? '',
    phoneNumber: row.phoneNumber,
    alternatePhone: row.alternatePhone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    city: row.cityRef?.name ?? '',
    country: row.cityRef?.country ?? '',
    warehouse: row.warehouse?.name ?? '',
    idType: row.idType ?? '',
    idNumber: row.idNumber ?? '',
    preferredChannel: row.preferredChannel,
    status: row.isActive ? 'Active' : 'Inactive',
    packages: row._count?.packages ?? 0,
    invoices: row._count?.invoices ?? 0,
    payments: row._count?.payments ?? 0,
    createdAt: row.createdAt.toISOString().slice(0, 10),
  };
}

@Injectable()
export class CustomersExportService {
  describe(
    format: CustomerExportFormat,
    all: boolean = false,
  ): CustomerExportFileInfo {
    const stamp = new Date().toISOString().slice(0, 10);
    const prefix = all ? 'customers-all' : 'customers';

    if (format === 'excel') {
      return {
        filename: `${prefix}-${stamp}.xlsx`,
        contentType: EXCEL_CONTENT_TYPE,
      };
    }

    return {
      filename: `${prefix}-${stamp}.pdf`,
      contentType: 'application/pdf',
    };
  }

  async generate(
    rows: CustomerExportRow[],
    format: CustomerExportFormat,
    all: boolean = false,
  ): Promise<CustomerExportFile> {
    const info = this.describe(format, all);

    if (format === 'excel') {
      return { ...info, buffer: await this.buildExcel(rows) };
    }

    return { ...info, buffer: await this.buildPdf(rows) };
  }

  /**
   * Stream an export directly to the HTTP response while consuming rows in
   * batches. Memory stays bounded and the database is only ever asked for one
   * batch at a time.
   */
  async stream(
    batches: AsyncIterable<CustomerExportRow[]>,
    format: CustomerExportFormat,
    res: Response,
  ): Promise<void> {
    if (format === 'excel') {
      await this.streamExcel(batches, res);
      return;
    }

    await this.streamPdf(batches, res);
  }

  private async buildExcel(rows: CustomerExportRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AOSTP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Customers', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = EXCEL_COLUMNS;

    rows.forEach((row) => {
      sheet.addRow(toExcelRow(row));
    });

    this.styleExcelHeader(sheet);
    this.styleExcelBody(sheet);

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.from(buffer);
  }

  private async streamExcel(
    batches: AsyncIterable<CustomerExportRow[]>,
    res: Response,
  ): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: false,
    });
    workbook.creator = 'AOSTP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Customers', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = EXCEL_COLUMNS;
    this.styleExcelHeader(sheet);

    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    try {
      for await (const rows of batches) {
        if (closed) {
          break;
        }

        for (const row of rows) {
          sheet.addRow(toExcelRow(row)).commit();
        }
      }

      sheet.commit();
      await workbook.commit();
    } catch (error) {
      if (!res.writableEnded) {
        res.destroy(error as Error);
      }
    }
  }

  private styleExcelHeader(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.height = 20;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    if (sheet.columnCount > 0) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columnCount },
      };
    }
  }

  private styleExcelBody(sheet: ExcelJS.Worksheet): void {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      row.alignment = { vertical: 'top', horizontal: 'left' };
    });
  }

  private buildPdf(rows: CustomerExportRow[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
      });

      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const table = this.createPdfTable(doc, `${rows.length} customer(s)`);

      rows.forEach((row) => table.addRow(row));
      table.finish(rows.length === 0);

      doc.end();
    });
  }

  private async streamPdf(
    batches: AsyncIterable<CustomerExportRow[]>,
    res: Response,
  ): Promise<void> {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
    });

    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    doc.on('error', (error) => {
      if (!res.writableEnded) {
        res.destroy(error);
      }
    });

    doc.pipe(res);

    const table = this.createPdfTable(doc, 'all matching customers');
    let count = 0;

    try {
      for await (const rows of batches) {
        if (closed) {
          break;
        }

        for (const row of rows) {
          table.addRow(row);
          count += 1;
        }
      }

      table.finish(count === 0);
      doc.end();
    } catch (error) {
      if (!res.writableEnded) {
        res.destroy(error as Error);
      }
    }
  }

  private createPdfTable(
    doc: PDFDocument,
    subtitle: string,
  ): {
    addRow: (row: CustomerExportRow) => void;
    finish: (empty: boolean) => void;
  } {
    const left = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 20;

    const totalWeight = PDF_COLUMNS.reduce(
      (total, column) => total + column.weight,
      0,
    );
    const widths = PDF_COLUMNS.map(
      (column) => (contentWidth * column.weight) / totalWeight,
    );

    const rowHeight = 18;

    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor('#111827')
      .text('Customer Export', left, 30, {
        width: contentWidth,
        align: 'center',
      });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6B7280')
      .text(
        `Generated ${new Date().toLocaleString('en-GB')} • ${subtitle}`,
        left,
        52,
        { width: contentWidth, align: 'center' },
      );

    const drawHeader = (position: number): number => {
      doc
        .save()
        .rect(left, position, contentWidth, rowHeight)
        .fill('#E5E7EB')
        .restore();

      let x = left;
      PDF_COLUMNS.forEach((column, index) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#111827')
          .text(column.header, x + 4, position + 5, {
            width: widths[index] - 8,
            lineBreak: false,
          });
        x += widths[index];
      });

      return position + rowHeight;
    };

    let y = drawHeader(78);
    let rowIndex = 0;

    return {
      addRow: (row: CustomerExportRow) => {
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          y = drawHeader(doc.page.margins.top);
        }

        if (rowIndex % 2 === 1) {
          doc
            .save()
            .rect(left, y, contentWidth, rowHeight)
            .fill('#F9FAFB')
            .restore();
        }

        let x = left;
        PDF_COLUMNS.forEach((column, columnIndex) => {
          const text = this.truncate(
            doc,
            column.value(row),
            widths[columnIndex] - 8,
          );

          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#111827')
            .text(text, x + 4, y + 5, {
              width: widths[columnIndex] - 8,
              lineBreak: false,
            });

          x += widths[columnIndex];
        });

        y += rowHeight;
        rowIndex += 1;
      },
      finish: (empty: boolean) => {
        if (!empty) {
          return;
        }

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#6B7280')
          .text('No customers matched the selected filters.', left, y + 10, {
            width: contentWidth,
            align: 'center',
          });
      },
    };
  }

  private truncate(doc: PDFDocument, text: string, maxWidth: number): string {
    if (!text) {
      return '';
    }

    doc.font('Helvetica').fontSize(8);

    if (doc.widthOfString(text) <= maxWidth) {
      return text;
    }

    let value = text;
    while (value.length > 1 && doc.widthOfString(`${value}...`) > maxWidth) {
      value = value.slice(0, -1);
    }

    return `${value}...`;
  }
}
