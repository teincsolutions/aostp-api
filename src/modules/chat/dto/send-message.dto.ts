import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  to: string;

  @ValidateIf((o) => !o.type || o.type === 'text')
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsEnum(['text', 'image', 'document', 'audio', 'video'])
  type?: string = 'text';

  @ValidateIf((o) => o.type && o.type !== 'text')
  @IsString()
  @IsNotEmpty()
  mediaUrl?: string;

  @ValidateIf((o) => o.type === 'document')
  @IsString()
  @IsNotEmpty()
  filename?: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  bucket?: string;
}
