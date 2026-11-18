import { IsEnum, IsOptional, IsString, MaxLength, MinLength, IsUUID } from 'class-validator';
import { IncidentSeverity } from '@prisma/client';
export class CreateIncidentDto {
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @IsOptional() @IsUUID() assignedToUserId?: string;
  @IsOptional() @IsUUID() serviceId?: string;
}
