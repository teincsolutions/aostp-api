import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { UploadsService } from './uploads.service';
import {
  UploadPackageDto,
  UploadUserDto,
  UploadPaymentDto,
  S3UploadResultDto,
} from './dto';
import { Public } from '../../shared/decorators/public.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Public()
  @ApiOperation({
    summary: 'Upload a file for a package',
    description:
      'Uploads a file to S3 for a specific package in the specified folder.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The file to upload',
        },
        folder: {
          type: 'string',
          enum: ['pictures', 'videos'],
          description: 'Folder to upload the file to',
        },
        packageId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the package',
        },
        bucketType: {
          type: 'string',
          enum: ['packages', 'users', 'logs'],
          description: 'Type of bucket to upload to (optional)',
        },
        fileName: {
          type: 'string',
          description: 'Original file name (optional)',
        },
      },
      required: ['file', 'folder', 'packageId'],
    },
  })
  @ApiResponse({
    status: 201,
    type: S3UploadResultDto,
    description: 'File uploaded successfully',
  })
  @ApiBadRequestResponse({
    description: 'Bad request - File or required parameters missing',
  })
  @Post('packages')
  @UseInterceptors(FilesInterceptor('files', 3))
  async uploadPackageFile(
    @Body() dto: UploadPackageDto,
    @UploadedFiles() files: Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Files are required');
    }

    const results = await Promise.all(
      files.map((file) =>
        this.uploadsService.uploadPackageFile(dto, file.buffer, file.mimetype),
      ),
    );
    return results;
  }

  @Public()
  @ApiOperation({
    summary: 'Upload a file for a user',
    description:
      'Uploads a file to S3 for a specific user in the specified folder.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The file to upload',
        },
        folder: {
          type: 'string',
          enum: ['general', 'avatar'],
          description: 'Folder to upload the file to',
        },
        userId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the user',
        },
        bucketType: {
          type: 'string',
          enum: ['packages', 'users', 'logs'],
          description: 'Type of bucket to upload to (optional)',
        },
        fileName: {
          type: 'string',
          description: 'Original file name (optional)',
        },
      },
      required: ['file', 'folder', 'userId'],
    },
  })
  @ApiResponse({
    status: 201,
    type: S3UploadResultDto,
    description: 'File uploaded successfully',
  })
  @ApiBadRequestResponse({
    description: 'Bad request - File or required parameters missing',
  })
  @Post('users')
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserFile(
    @Body() dto: UploadUserDto,
    @UploadedFile() file: Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.uploadsService.uploadUserFile(
      dto,
      file.buffer,
      file.mimetype,
    );
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PAYMENT_CLERK, UserRole.FINANCE_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Upload a reference document for a payment (CR-01)',
    description:
      'Uploads a payment reference document to S3. Supports PDF, JPG, PNG files up to 5MB. Only accessible by Payment Clerk, Finance Manager, and Super Admin.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The reference document to upload (PDF, JPG, PNG)',
        },
        folder: {
          type: 'string',
          enum: ['reference-documents'],
          description: 'Folder to upload the file to',
          default: 'reference-documents',
        },
        paymentId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the payment',
        },
        bucketType: {
          type: 'string',
          enum: ['packages', 'users', 'logs', 'payments'],
          description: 'Type of bucket to upload to (optional)',
        },
        fileName: {
          type: 'string',
          description: 'Original file name (optional)',
        },
      },
      required: ['file', 'folder', 'paymentId'],
    },
  })
  @ApiResponse({
    status: 201,
    type: S3UploadResultDto,
    description: 'Payment reference document uploaded successfully',
  })
  @ApiBadRequestResponse({
    description:
      'Bad request - File missing, invalid type, or exceeds 5MB size limit',
  })
  @Post('payments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPaymentFile(
    @Body() dto: UploadPaymentDto,
    @UploadedFile() file: Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.uploadsService.uploadPaymentFile(
      dto,
      file.buffer,
      file.mimetype,
    );
    return result;
  }
}
