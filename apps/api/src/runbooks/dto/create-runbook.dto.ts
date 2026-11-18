import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
export class CreateRunbookDto {
  @IsString() @MinLength(3) @MaxLength(150) title!: string;
  @IsUrl({ require_protocol: true }) @MaxLength(1000) url!: string;
  @IsOptional() @IsIn(['RUNBOOK', 'PLAYBOOK', 'DASHBOARD', 'POSTMORTEM']) category?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
