import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import type { ReportJobData } from './reports.processor';

@Injectable()
export class ReportsQueue {
  private readonly logger = new Logger(ReportsQueue.name);

  constructor(
    @InjectQueue('reports-queue')
    private readonly queue: Queue,
  ) {}

  /**
   * Add a report generation job to the queue
   */
  async addReportJob(jobData: ReportJobData): Promise<string> {
    this.logger.log(`Adding report job to queue: ${jobData.reportType}`);

    const job = await this.queue.add('generate-report', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: false,
      removeOnFail: false,
    });

    this.logger.log(`Report job added with ID: ${job.id}`);
    return job.id.toString();
  }

  /**
   * Get job status and result
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    result?: any;
    error?: string;
  }> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return { status: 'NOT_FOUND' };
    }

    const state = await job.getState();

    if (state === 'completed') {
      return {
        status: 'COMPLETED',
        result: job.returnvalue,
      };
    }

    if (state === 'failed') {
      return {
        status: 'FAILED',
        error: job.failedReason,
      };
    }

    return { status: state.toUpperCase() };
  }
}
