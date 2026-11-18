import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
@Controller('auth')
export class AuthController {
 constructor(private readonly auth:AuthService){}
 @Post('register') register(@Body() body:RegisterDto){return this.auth.register(body)}
 @Post('login') login(@Body() body:LoginDto){return this.auth.login(body)}
 @Post('accept-invitation') acceptInvitation(@Body() body:AcceptInvitationDto){return this.auth.acceptInvitation(body)}
}
