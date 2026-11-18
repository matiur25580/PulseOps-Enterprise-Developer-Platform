import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(72) password!: string;
  @IsString() @Length(2, 100) tenantName!: string;
}
