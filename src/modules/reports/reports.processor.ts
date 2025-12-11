import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ReportsService } from './reports.service';
import type { ReportQueryDto } from './dto/common.dto';

export interface ReportJobData {
  reportType:
    | 'payments'
    | 'packing-lists'
    | 'customer-league'
    | 'shipping-method'
    | 'general'
    | 'pickups'
    | 'warehouses';
  filters: ReportQueryDto;
  userId: string;
}

@Processor('reports-queue')
export class ReportsProcessor {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Process('generate-report')
  async handleReportGeneration(job: Job<ReportJobData>) {
    this.logger.log(
      `Processing report job ${job.id} - Type: ${job.data.reportType}`,
    );

    try {
      let result: any;

      switch (job.data.reportType) {
        case 'payments':
          result = await this.reportsService.getPaymentsReport(
            job.data.filters,
          );
          break;

        case 'packing-lists':
          result = await this.reportsService.getPackingListReport(
            job.data.filters,
          );
          break;

        case 'customer-league':
          result = await this.reportsService.getCustomerLeagueReport(
            job.data.filters,
          );
          break;

        case 'shipping-method':
          result = await this.reportsService.getShippingMethodReport(
            job.data.filters,
          );
          break;

        case 'general':
          result = await this.reportsService.getGeneralReport(job.data.filters);
          break;

        case 'pickups':
          result = await this.reportsService.getPickupReport(job.data.filters);
          break;

        case 'warehouses':
          result = await this.reportsService.getWarehouseReport(
            job.data.filters,
          );
          break;

        default:
          throw new Error(`Unknown report type: ${job.data.reportType}`);
      }

      this.logger.log(`Report job ${job.id} completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `Report job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
