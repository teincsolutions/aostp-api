import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

export interface InvoiceNotificationJobData {
  invoiceId: string;
  invoiceNumber: string;
  invoicePdfKey: string | null;
  customerId: string;
  customerFirstName: string;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhoneNumber: string | null;
  customerPreferredChannel: string | null;
  packingListName: string | null;
  totalAmount: number;
  currency: string;
  dueDate: string;
}

export interface NotificationJobData {
  type: 'INVOICE_ISSUED' | 'PAYMENT_RECEIVED' | 'SHIPMENT_UPDATE';
  data: InvoiceNotificationJobData | Record<string, any>;
}

@Injectable()
export class NotificationsQueue {
  private readonly logger = new Logger(NotificationsQueue.name);

  constructor(
    @InjectQueue('notifications-queue')
    private readonly queue: Queue,
  ) {}

  /**
   * Add an invoice notification job to the queue
   */
  async addInvoiceNotificationJob(
    jobData: InvoiceNotificationJobData,
  ): Promise<string> {
    this.logger.log(
      `Adding invoice notification job to queue: ${jobData.invoiceNumber}`,
    );

    const job = await this.queue.add(
      'send-invoice-notification',
      {
        type: 'INVOICE_ISSUED',
        data: jobData,
      } as NotificationJobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000, // 3 seconds initial delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );

    this.logger.log(`Invoice notification job added with ID: ${job.id}`);
    return job.id.toString();
  }

  /**
   * Get job status
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

  /**
   * Get queue stats
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}
