import { Injectable } from '@nestjs/common';
import { Customer } from '@prisma/client';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { CustomerExportFormat } from './dto/export-customers.dto';

export const CUSTOMER_EXPORT_ROW_LIMIT = 5000;

export interface CustomerExportRow extends Customer {
  warehouse: { id: string; name: string; location: string } | null;
  cityRef: { id: string; name: string; country: string } | null;
  _count: { packages: number; invoices: number; payments: number };
}

export interface CustomerExportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Injectable()
export class CustomersExportService {
  async generate(
    rows: CustomerExportRow[],
    format: CustomerExportFormat,
  ): Promise<CustomerExportFile> {
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'excel') {
      return {
        buffer: await this.buildExcel(rows),
        filename: `customers-${stamp}.xlsx`,
        contentType: EXCEL_CONTENT_TYPE,
      };
    }

    return {
      buffer: await this.buildPdf(rows),
      filename: `customers-${stamp}.pdf`,
      contentType: 'application/pdf',
    };
  }

  private async buildExcel(rows: CustomerExportRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AOSTP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Customers', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
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

    rows.forEach((row) => {
      sheet.addRow({
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
      });
    });

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

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      row.alignment = { vertical: 'top', horizontal: 'left' };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return Buffer.from(buffer);
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

      const left = doc.page.margins.left;
      const contentWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottomLimit = doc.page.height - doc.page.margins.bottom - 20;

      const columns: Array<{
        header: string;
        weight: number;
        value: (row: CustomerExportRow) => string;
      }> = [
        {
          header: 'Code',
          weight: 12,
          value: (row) => row.customerCode,
        },
        {
          header: 'Customer Name',
          weight: 20,
          value: (row) =>
            [row.firstName, row.lastName].filter(Boolean).join(' '),
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

      const totalWeight = columns.reduce(
        (total, column) => total + column.weight,
        0,
      );
      const widths = columns.map(
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
          `Generated ${new Date().toLocaleString('en-GB')} • ${rows.length} customer(s)`,
          left,
          52,
          { width: contentWidth, align: 'center' },
        );

      let y = 78;

      const drawHeader = (position: number): number => {
        doc
          .save()
          .rect(left, position, contentWidth, rowHeight)
          .fill('#E5E7EB')
          .restore();

        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);

        let x = left;
        columns.forEach((column, index) => {
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

      y = drawHeader(y);

      rows.forEach((row, index) => {
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          y = drawHeader(doc.page.margins.top);
        }

        if (index % 2 === 1) {
          doc
            .save()
            .rect(left, y, contentWidth, rowHeight)
            .fill('#F9FAFB')
            .restore();
        }

        let x = left;
        columns.forEach((column, columnIndex) => {
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
      });

      if (rows.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#6B7280')
          .text('No customers matched the selected filters.', left, y + 10, {
            width: contentWidth,
            align: 'center',
          });
      }

      doc.end();
    });
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
