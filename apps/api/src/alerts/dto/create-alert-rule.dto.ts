import { IsInt, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateAlertRuleDto {
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsNumber() @Min(0) @Max(100) thresholdPercent!: number;
  @IsInt() @Min(1) @Max(1440) cooldownMinutes = 30;
}
