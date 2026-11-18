import { CloudProvider } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
export class CostRecordDto {
  @IsEnum(CloudProvider) provider!: CloudProvider;
  @IsString() @MaxLength(200) sourceRecordId!: string;
  @IsString() @MaxLength(300) resourceId!: string;
  @IsOptional() @IsString() @MaxLength(300) resourceName?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
  @IsDateString() @Matches(/^\d{4}-\d{2}-01T00:00:00(\.000)?Z$/, { message: 'billingPeriodStart must be the first day of a UTC month' })
  billingPeriodStart!: string;
  @IsNumber({ maxDecimalPlaces: 6 }) @Min(0) costAmount!: number;
  @Matches(/^[A-Za-z]{3}$/) currency!: string;
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsObject() tags?: Record<string, unknown>;
}
