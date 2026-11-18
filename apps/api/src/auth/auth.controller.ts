import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthenticatedUser, JwtAuthGuard } from './jwt-auth.guard';
type AuthRequest=Request&{user?:AuthenticatedUser};
const COOKIE='pulseops_refresh',MAX_AGE=30*24*60*60;
function readCookie(req:Request){const entry=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='));if(!entry)return undefined;try{return decodeURIComponent(entry.slice(COOKIE.length+1));}catch{return undefined;}}
function setCookie(res:Response,token:string){const prod=process.env.NODE_ENV==='production';res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/api/v1/auth; Max-Age=${MAX_AGE}; SameSite=${prod?'None':'Lax'}${prod?'; Secure':''}`);}
function assertTrustedOrigin(req:Request){const origin=req.headers.origin;if(origin&&process.env.WEB_ORIGIN&&origin!==process.env.WEB_ORIGIN)throw new ForbiddenException('Untrusted request origin');if(origin&&process.env.NODE_ENV==='production'&&!process.env.WEB_ORIGIN)throw new ForbiddenException('WEB_ORIGIN must be configured for cookie-authenticated requests');}\nfunction clearCookie(res:Response){const prod=process.env.NODE_ENV==='production';res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; Path=/api/v1/auth; Max-Age=0; SameSite=${prod?'None; Secure':'Lax'}`);}
function hide<T extends{refreshToken:string}>(r:T){const{refreshToken,...body}=r;return{refreshToken,body};}
@Controller('auth')
export class AuthController{
 constructor(private readonly auth:AuthService){}
 @Post('register') async register(@Body() body:RegisterDto,@Req() req:Request,@Res({passthrough:true}) res:Response){await this.auth.assertRateLimit('register',req.ip??'unknown',20,3600);const r=hide(await this.auth.register(body));setCookie(res,r.refreshToken);return r.body;}
 @Post('login') async login(@Body() body:LoginDto,@Req() req:Request,@Res({passthrough:true}) res:Response){await this.auth.assertRateLimit('login',`${req.ip??'unknown'}:${body.email.trim().toLowerCase()}`,10,900);const r=hide(await this.auth.login(body));setCookie(res,r.refreshToken);return r.body;}
 @Post('accept-invitation') async acceptInvitation(@Body() body:AcceptInvitationDto,@Res({passthrough:true}) res:Response){const r=hide(await this.auth.acceptInvitation(body));setCookie(res,r.refreshToken);return r.body;}
 @Post('refresh') async refresh(@Req() req:Request,@Res({passthrough:true}) res:Response){assertTrustedOrigin(req);await this.auth.assertRateLimit('refresh',req.ip??'unknown',30,900);const r=hide(await this.auth.refresh(readCookie(req)??''));setCookie(res,r.refreshToken);return r.body;}
 @Post('logout') async logout(@Req() req:Request,@Res({passthrough:true}) res:Response){assertTrustedOrigin(req);await this.auth.logout(readCookie(req));clearCookie(res);return{loggedOut:true};}
 @UseGuards(JwtAuthGuard) @Post('logout-all') async logoutAll(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response){const r=await this.auth.logoutAll(req.user!.sub,req.user!.tenantId);clearCookie(res);return r;}
 @UseGuards(JwtAuthGuard) @Get('sessions') sessions(@Req() req:AuthRequest){return this.auth.listSessions(req.user!.sub,req.user!.tenantId);}
 @UseGuards(JwtAuthGuard) @Delete('sessions/:id') revokeSession(@Req() req:AuthRequest,@Param('id') id:string){return this.auth.revokeSession(req.user!.sub,req.user!.tenantId,id);}
}
