import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(12) @MaxLength(72) password!: string;
  @IsString() @Length(2, 120) tenantSlug!: string;
}
