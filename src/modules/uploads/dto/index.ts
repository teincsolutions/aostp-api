export enum BucketType {
  PACKAGES = 'packages',
  USERS = 'users',
  LOGS = 'logs',
  PAYMENTS = 'payments',
}

export * from './upload-package.dto';
export * from './upload-user.dto';
export * from './upload-log.dto';
export * from './upload-payment.dto';
export * from './upload-generic.dto';
export * from './upload-response.dto';
