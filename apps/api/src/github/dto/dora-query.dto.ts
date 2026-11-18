import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
export class DoraQueryDto {
  @Type(() => Number) @IsInt() @Min(7) @Max(90)
  windowDays = 30;
}
