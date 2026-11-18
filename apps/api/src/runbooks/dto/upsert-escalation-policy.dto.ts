import { IsEmail, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
export class UpsertEscalationPolicyDto {
  @IsEmail() primaryContactEmail!: string;
  @IsOptional() @IsEmail() secondaryContactEmail?: string;
  @IsInt() @Min(1) @Max(1440) escalationAfterMinutes = 15;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(1000) onCallUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
