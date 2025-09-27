import { NestFactory } from '@nestjs/core';
import { SeedModule } from './shared/seed/seed.module';
import { SeedService } from './shared/seed/seed.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('SeedScript');

  try {
    logger.log('🌱 Starting database seeding...');

    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(SeedModule);

    // Get the seed service
    const seedService = app.get(SeedService);

    // Run the seeding
    await seedService.runAllSeeds();

    // Close the application
    await app.close();

    logger.log('🎉 Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

void bootstrap();
