import { ApiProperty } from '@nestjs/swagger';

export class S3UploadResultDto {
  @ApiProperty({
    description: 'The S3 key of the uploaded file',
    example: 'pictures/uuid/packageId/1703123456_abcd123.jpg',
  })
  key: string;

  @ApiProperty({
    description: 'The URL to access the uploaded file',
    example:
      'https://packages-bucket.s3.us-east-1.amazonaws.com/pictures/uuid/packageId/1703123456_abcd123.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'The name of the S3 bucket where the file was uploaded',
    example: 'packages-bucket',
  })
  bucket: string;

  @ApiProperty({
    description: 'The size of the uploaded file in bytes',
    example: 1024000,
    required: false,
  })
  size?: number;
}

export * from './upload-log.dto';
