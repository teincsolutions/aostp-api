import { Injectable, Logger, Optional } from '@nestjs/common';
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

export interface PaymentNotificationJobData {
  paymentId: string;
  paymentCode: string;
  receiptPdfKey: string | null;
  customerId: string;
  customerFirstName: string;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhoneNumber: string | null;
  customerPreferredChannel: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  processedAt: string;
}

export interface NotificationJobData {
  type: 'INVOICE_ISSUED' | 'PAYMENT_RECEIVED' | 'SHIPMENT_UPDATE';
  data: InvoiceNotificationJobData | PaymentNotificationJobData | Record<string, any>;
}

@Injectable()
export class NotificationsQueue {
  private readonly logger = new Logger(NotificationsQueue.name);
  private isQueueReady = false;

  constructor(
    @Optional()
    @InjectQueue('notifications-queue')
    private readonly queue: Queue | null,
  ) {
    this.initializeQueue();
  }

  private async initializeQueue() {
    if (!this.queue) {
      this.logger.warn('Notification queue not available - Redis may not be configured');
      return;
    }

    try {
      // Set up event listeners
      this.queue.on('ready', () => {
        this.isQueueReady = true;
        this.logger.log('Notification queue connected to Redis');
      });

      this.queue.on('error', (error) => {
        this.isQueueReady = false;
        this.logger.warn(`Notification queue error: ${error.message}`);
      });

      // Check if already connected by trying to ping
      const client = this.queue.client;
      if (client) {
        // Try to check connection status
        if (client.status === 'ready') {
          this.isQueueReady = true;
          this.logger.log('Notification queue initialized successfully');
        } else {
          // Wait a bit and check again - Redis might be connecting
          setTimeout(async () => {
            try {
              await this.queue!.isReady();
              this.isQueueReady = true;
              this.logger.log('Notification queue ready after delay');
            } catch (err) {
              this.logger.warn('Notification queue not ready after delay');
            }
          }, 2000);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize notification queue: ${error.message}`);
      this.isQueueReady = false;
    }
  }

  /**
   * Check if the queue is available and ready
   * Also does a live check if not marked ready
   */
  async checkAndUpdateReadyState(): Promise<boolean> {
    if (!this.queue) return false;
    
    try {
      await this.queue.isReady();
      this.isQueueReady = true;
      return true;
    } catch {
      this.isQueueReady = false;
      return false;
    }
  }

  /**
   * Check if the queue is available and ready
   */
  isAvailable(): boolean {
    return this.queue !== null && this.isQueueReady;
  }

  /**
   * Add an invoice notification job to the queue
   */
  async addInvoiceNotificationJob(
    jobData: InvoiceNotificationJobData,
  ): Promise<string | null> {
    // Check if ready, if not try a live check
    if (!this.isAvailable()) {
      const isReady = await this.checkAndUpdateReadyState();
      if (!isReady) {
        this.logger.warn(
          `Cannot queue invoice notification for ${jobData.invoiceNumber} - Redis unavailable`,
        );
        return null;
      }
    }

    try {
      this.logger.log(
        `Adding invoice notification job to queue: ${jobData.invoiceNumber}`,
      );

      const job = await this.queue!.add(
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
    } catch (error) {
      this.logger.error(
        `Failed to queue invoice notification for ${jobData.invoiceNumber}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Add a payment receipt notification job to the queue
   */
  async addPaymentNotificationJob(
    jobData: PaymentNotificationJobData,
  ): Promise<string | null> {
    // Check if ready, if not try a live check
    if (!this.isAvailable()) {
      const isReady = await this.checkAndUpdateReadyState();
      if (!isReady) {
        this.logger.warn(
          `Cannot queue payment notification for ${jobData.paymentCode} - Redis unavailable`,
        );
        return null;
      }
    }

    try {
      this.logger.log(
        `Adding payment notification job to queue: ${jobData.paymentCode}`,
      );

      const job = await this.queue!.add(
        'send-payment-notification',
        {
          type: 'PAYMENT_RECEIVED',
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

      this.logger.log(`Payment notification job added with ID: ${job.id}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(
        `Failed to queue payment notification for ${jobData.paymentCode}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    result?: any;
    error?: string;
  }> {
    if (!this.isAvailable()) {
      return { status: 'QUEUE_UNAVAILABLE' };
    }

    const job = await this.queue!.getJob(jobId);

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
    if (!this.isAvailable()) {
      return {
        status: 'QUEUE_UNAVAILABLE',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue!.getWaitingCount(),
      this.queue!.getActiveCount(),
      this.queue!.getCompletedCount(),
      this.queue!.getFailedCount(),
      this.queue!.getDelayedCount(),
    ]);

    return {
      status: 'OK',
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}
