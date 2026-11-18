import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
export enum SloIndicatorInput { AVAILABILITY = 'AVAILABILITY', LATENCY = 'LATENCY' }
export class CreateSloDto {
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsEnum(SloIndicatorInput) indicator!: SloIndicatorInput;
  @IsNumber() @Min(0.01) @Max(100) targetPercent!: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) windowDays?: number;
  @ValidateIf(o => o.indicator === 'LATENCY') @IsInt() @Min(1) latencyThresholdMs?: number;
}
