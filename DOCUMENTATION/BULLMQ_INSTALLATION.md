# BullMQ Queue Installation (Optional)

The Reports module includes optional BullMQ queue support for heavy report generation tasks that may take longer to process.

## When to Enable

Enable BullMQ queue if:

- You have more than 100,000 records
- Reports take longer than 5 seconds
- You want to process reports in the background
- You need to track report generation progress

## Installation Steps

### 1. Install Dependencies

```bash
npm install @nestjs/bull bull
npm install -D @types/bull
```

### 2. Install Redis

BullMQ requires Redis:

**Using Docker:**

```bash
docker run -d -p 6379:6379 redis:alpine
```

**Or install locally:**

```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis
```

### 3. Update Reports Module

Edit `src/modules/reports/reports.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsQueue } from './reports.queue';
import { ReportsProcessor } from './reports.processor';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'reports-queue',
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsQueue, ReportsProcessor],
  exports: [ReportsService, ReportsQueue],
})
export class ReportsModule {}
```

### 4. Register BullModule in App Module

Edit `src/app.module.ts`:

```typescript
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    // ... other imports
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    // ... other modules
  ],
  // ...
})
export class AppModule {}
```

### 5. Add Environment Variables

Add to `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 6. Add Queue Endpoints to Controller

Add to `src/modules/reports/reports.controller.ts`:

```typescript
import { ReportsQueue } from './reports.queue';

export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsQueue: ReportsQueue, // Add this
  ) {}

  @Post('payments/async')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Generate payments report asynchronously' })
  async generatePaymentsReportAsync(
    @Query() query: ReportQueryDto,
    @Request() req,
  ): Promise<{ jobId: string; status: string }> {
    const jobId = await this.reportsQueue.addReportJob({
      reportType: 'payments',
      filters: query,
      userId: req.user.id,
    });

    return {
      jobId,
      status: 'QUEUED',
    };
  }

  @Get('job/:jobId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE_MANAGER,
    UserRole.OPERATIONS_CLERK,
  )
  @ApiOperation({ summary: 'Get report job status' })
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.reportsQueue.getJobStatus(jobId);
  }
}
```

## Usage After Installation

### Generate Report Asynchronously

```bash
curl -X POST "http://localhost:3000/reports/payments/async?fromDate=2025-01-01T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "jobId": "123",
  "status": "QUEUED"
}
```

### Check Job Status

```bash
curl -X GET "http://localhost:3000/reports/job/123" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response (processing):
{
  "status": "ACTIVE"
}

# Response (completed):
{
  "status": "COMPLETED",
  "result": { /* report data */ }
}

# Response (failed):
{
  "status": "FAILED",
  "error": "Error message"
}
```

## Bull Board (Optional Dashboard)

Install Bull Board for a web UI to monitor jobs:

```bash
npm install @bull-board/api @bull-board/express
```

Then add to your app:

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

// In main.ts or app setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(reportsQueue)],
  serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

Access at: `http://localhost:3000/admin/queues`

## Troubleshooting

### "Cannot connect to Redis"

- Ensure Redis is running: `redis-cli ping` (should return "PONG")
- Check host/port in .env

### Jobs stuck in "waiting"

- Check processor is registered in module
- Verify processor decorator: `@Process('generate-report')`

### High memory usage

- Adjust job concurrency in BullModule config
- Enable `removeOnComplete: true` to auto-cleanup

## Performance Benefits

With BullMQ enabled:

- **Non-blocking API:** Immediate response with job ID
- **Retry logic:** Automatic retry on failure (3 attempts)
- **Progress tracking:** Monitor long-running reports
- **Concurrency:** Process multiple reports in parallel
- **Job history:** Track all report generation attempts

## When NOT to Enable

Skip BullMQ if:

- Your dataset is small (< 10,000 records)
- Reports complete in < 2 seconds
- You prefer simpler architecture
- You don't want to manage Redis

The synchronous endpoints work perfectly fine without BullMQ.
