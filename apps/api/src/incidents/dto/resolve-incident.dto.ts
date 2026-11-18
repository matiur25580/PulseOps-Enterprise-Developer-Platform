import { IsOptional, IsString, MaxLength } from 'class-validator';
export class ResolveIncidentDto {
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
}
