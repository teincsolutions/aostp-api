import * as winston from 'winston';
import Transport from 'winston-transport';
import { UploadsService } from '../../modules/uploads/uploads.service';
import { LogFolder } from '../../modules/uploads/dto';

export class S3LogTransport extends Transport {
  private uploadBuffer: string[] = [];
  private readonly bufferSize: number;
  private readonly flushInterval: number;
  private readonly uploadService: UploadsService;
  private flushTimer: NodeJS.Timeout;

  constructor(
    uploadService: UploadsService,
    options: {
      bufferSize?: number;
      flushInterval?: number;
      level?: string;
    } = {},
  ) {
    super(options);
    this.uploadService = uploadService;
    this.bufferSize = options.bufferSize || 100; // Buffer 100 log entries
    this.flushInterval = options.flushInterval || 5 * 60 * 1000; // 5 minutes

    // Start periodic flush
    this.startPeriodicFlush();
  }

  async log(info: winston.LogEntry, callback: () => void): Promise<void> {
    setImmediate(() => this.emit('logged', info));

    // Add log to buffer
    const logMessage = `[${new Date().toISOString()}] [${info.level.toUpperCase()}] ${info.message}\n`;
    this.uploadBuffer.push(logMessage);

    // Flush if buffer is full
    if (this.uploadBuffer.length >= this.bufferSize) {
      await this.flushLogs(LogFolder.SYSTEM);
    }

    callback();
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.uploadBuffer.length > 0) {
        void this.flushLogs(LogFolder.SYSTEM);
      }
    }, this.flushInterval);
  }

  private async flushLogs(folder: LogFolder): Promise<void> {
    if (this.uploadBuffer.length === 0) return;

    const logsContent = this.uploadBuffer.join('');
    this.uploadBuffer = [];

    try {
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `logs-${dateStr}-${Date.now()}.log`;

      await this.uploadService.uploadLogFile(
        {
          folder,
          fileName,
        },
        Buffer.from(logsContent, 'utf-8'),
        'text/plain',
      );
    } catch (error) {
      console.error('Failed to upload logs to S3:', error);
      this.uploadBuffer.unshift(
        ...logsContent.split('\n').filter((line) => line.trim()),
      );
    }
  }

  flushAndExit(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.uploadBuffer.length > 0) {
      void this.flushLogs(LogFolder.SYSTEM);
    }
  }
}

export const createWinstonLogger = (
  uploadsService: UploadsService,
  level: string = 'info',
  uploadIntervalMinutes: number = 60,
) => {
  const s3Transport = new S3LogTransport(uploadsService, {
    bufferSize: 50,
    flushInterval: uploadIntervalMinutes * 60 * 1000, // Convert minutes to milliseconds
    level,
  });

  const logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),

      // S3 upload transport
      s3Transport,
    ],
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    s3Transport.flushAndExit();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    s3Transport.flushAndExit();
    process.exit(0);
  });

  return logger;
};
