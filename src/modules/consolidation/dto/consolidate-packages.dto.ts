import {
  IsArray,
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';

export class ConsolidatePackagesDto {
  @IsArray()
  @ArrayMinSize(2)
  sourceTrackingCodes: string[];

  @IsString()
  @IsOptional()
  targetTrackingCode?: string;
}
