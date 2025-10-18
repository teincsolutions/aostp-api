import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
  Min,
  Max,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  API_VERSION: string;

  // Database
  @IsString()
  DATABASE_URL: string;

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_EXPIRATION: string;

  @IsString()
  JWT_REFRESH_EXPIRATION: string;

  // AWS S3
  @IsString()
  AWS_REGION: string;

  @IsString()
  AWS_ACCESS_KEY_ID: string;

  @IsString()
  AWS_SECRET_ACCESS_KEY: string;

  @IsString()
  AWS_PACKAGES_BUCKET_NAME: string;

  @IsString()
  AWS_USERS_BUCKET_NAME: string;

  @IsString()
  AWS_LOGS_BUCKET_NAME: string;

  @IsString()
  @IsOptional()
  AWS_S3_ENDPOINT?: string;

  // CORS
  @IsString()
  CORS_ORIGIN: string;

  // Rate Limiting
  @IsNumber()
  @IsOptional()
  RATE_LIMIT_WINDOW_MS?: number;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS?: number;

  // Encryption
  @IsString()
  ENCRYPTION_KEY: string;

  // Email (Optional)
  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  // SMS Provider (Optional)
  @IsString()
  @IsOptional()
  SMS_PROVIDER?: string;

  @IsString()
  @IsOptional()
  TWILIO_ACCOUNT_SID?: string;

  @IsString()
  @IsOptional()
  TWILIO_AUTH_TOKEN?: string;

  @IsString()
  @IsOptional()
  TWILIO_PHONE_NUMBER?: string;

  // Payment Gateway (Optional)
  @IsString()
  @IsOptional()
  PAYMENT_PROVIDER?: string;

  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  // Company Information (with defaults)
  @IsString()
  @IsOptional()
  COMPANY_NAME?: string;

  @IsString()
  @IsOptional()
  COMPANY_ADDRESS?: string;

  @IsString()
  @IsOptional()
  COMPANY_PHONE?: string;

  @IsString()
  @IsOptional()
  COMPANY_EMAIL?: string;

  // Logging
  @IsString()
  @IsOptional()
  LOG_LEVEL?: string;

  @IsString()
  @IsOptional()
  LOG_FORMAT?: string;

  // Monitoring
  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
