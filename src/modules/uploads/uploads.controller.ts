import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { UploadsService } from './uploads.service';
import {
  UploadPackageDto,
  UploadUserDto,
  UploadLogDto,
} from './dto';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('packages')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPackageFile(
    @Body() dto: UploadPackageDto,
    @UploadedFile() file: Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.uploadsService.uploadPackageFile(
      dto,
      file.buffer,
      file.mimetype,
    );
    return result;
  }

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

  @Post('logs')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogFile(
    @Body() dto: UploadLogDto,
    @UploadedFile() file: Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.uploadsService.uploadLogFile(
      dto,
      file.buffer,
      file.mimetype,
    );
    return result;
  }
}
