import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { UploadsService } from './uploads.service';
import { UploadPackageDto, UploadUserDto, S3UploadResultDto } from './dto';
import { Public } from '../../shared/decorators/public.decorator';

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
}
