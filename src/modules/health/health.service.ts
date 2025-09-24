import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { S3Service } from '../../providers/storage/s3.service';

export interface HealthStatus {
  status: 'ok' | 'error';
  services: {
    database: {
      status: 'ok' | 'error';
      message?: string;
    };
    s3: {
      status: 'ok' | 'error';
      message?: string;
    };
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    const healthStatus: HealthStatus = {
      status: 'ok',
      services: {
        database: { status: 'ok' },
        s3: { status: 'ok' },
      },
      timestamp: new Date().toISOString(),
    };

    // Check database
    try {
      await this.prisma.$executeRaw`SELECT 1`;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      healthStatus.services.database = {
        status: 'error',
        message: error.message,
      };
      healthStatus.status = 'error';
    }

    // Check S3
    const s3Health = await this.s3Service.healthCheck();
    if (!s3Health) {
      this.logger.error('S3 health check failed');
      healthStatus.services.s3 = {
        status: 'error',
        message: 'S3 service is not accessible',
      };
      healthStatus.status = 'error';
    }

    return healthStatus;
  }
}
