import { IsEnum, IsOptional, IsString, IsUUID, Length, MaxLength, IsUrl } from 'class-validator';

export enum ServiceLifecycleInput { EXPERIMENTAL = 'EXPERIMENTAL', PRODUCTION = 'PRODUCTION', DEPRECATED = 'DEPRECATED', RETIRED = 'RETIRED' }

export class CreateServiceDto {
  @IsString() @Length(2, 100) name!: string;
  @IsString() @Length(2, 100) slug!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) repository?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsEnum(ServiceLifecycleInput) lifecycle?: ServiceLifecycleInput;
}
