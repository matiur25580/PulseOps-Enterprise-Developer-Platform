import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
export class CreateTeamDto { @IsString() @Length(2, 100) name!: string; @IsOptional() @IsEmail() @MaxLength(254) email?: string; }
