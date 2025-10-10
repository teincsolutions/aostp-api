import { IsArray, IsString, IsNotEmpty, ArrayMinSize } from 'class-validator';

export class ConsolidatePackagesDto {
  @IsArray()
  @ArrayMinSize(2)
  sourceTrackingCodes: string[];

  @IsString()
  @IsNotEmpty()
  targetTrackingCode: string;
}
