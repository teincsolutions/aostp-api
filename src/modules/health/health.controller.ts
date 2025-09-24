import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthStatus } from './health.service';
import { Public } from '../../shared/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async getHealth(): Promise<HealthStatus> {
    return this.healthService.checkHealth();
  }
}
