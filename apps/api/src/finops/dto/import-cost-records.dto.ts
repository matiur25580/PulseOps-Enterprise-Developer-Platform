import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CostRecordDto } from './cost-record.dto';
export class ImportCostRecordsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => CostRecordDto)
  records!: CostRecordDto[];
}
