import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CreateCostBudgetDto {
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0.000001) amount!: number;
  @Matches(/^[A-Za-z]{3}$/) currency!: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1000) thresholdPercent = 80;
}
