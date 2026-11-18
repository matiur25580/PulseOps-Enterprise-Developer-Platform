import { IsEmail, MaxLength } from 'class-validator';
export class CreateInvitationDto { @IsEmail() @MaxLength(254) email!:string; }
