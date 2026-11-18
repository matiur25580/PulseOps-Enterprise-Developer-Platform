import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
@Injectable()
export class MembersService {
 constructor(private readonly prisma:PrismaService, private readonly audit:AuditService){}
 async list(tenantId:string){
  const rows=await this.prisma.tenantMembership.findMany({where:{tenantId},include:{user:{select:{id:true,name:true,email:true}}},orderBy:{createdAt:'asc'}});
  return rows.map(({id,role,createdAt,user})=>({id,role,createdAt,user}));
 }
 async createInvitation(tenantId:string,createdByUserId:string,input:CreateInvitationDto){
  const email=input.email.trim().toLowerCase();
  const existing=await this.prisma.user.findUnique({where:{email},include:{memberships:{where:{tenantId},select:{id:true}}}});
  if(existing?.memberships.length)throw new ConflictException('This user is already a workspace member');
  const pending=await this.prisma.workspaceInvitation.findFirst({where:{tenantId,email,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},select:{id:true}});
  if(pending)throw new ConflictException('A pending invitation already exists for this email');
  const token=randomBytes(32).toString('hex');const expiresAt=new Date(Date.now()+7*24*60*60*1000);
  const invitation=await this.prisma.workspaceInvitation.create({data:{tenantId,email,role:'MEMBER',tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt,createdByUserId},select:{id:true,email:true,role:true,expiresAt:true,createdAt:true}});
  await this.audit.record({tenantId,actorId:createdByUserId,action:'INVITATION_CREATED',entityType:'WORKSPACE_INVITATION',entityId:invitation.id,metadata:{email,role:'MEMBER'}});
  return {invitation,acceptanceToken:token};
 }
 async revokeInvitation(tenantId:string,actorId:string,id:string){
  const result=await this.prisma.workspaceInvitation.updateMany({where:{id,tenantId,acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
  if(!result.count)throw new NotFoundException('Pending invitation not found');
  await this.audit.record({tenantId,actorId,action:'INVITATION_REVOKED',entityType:'WORKSPACE_INVITATION',entityId:id});
  return {revoked:true,id};
 }
 async updateRole(tenantId:string,actorId:string,userId:string,input:UpdateMemberRoleDto){
  try{const updated=await this.prisma.$transaction(async tx=>{
   const target=await tx.tenantMembership.findUnique({where:{userId_tenantId:{userId,tenantId}}});
   if(!target)throw new NotFoundException('Workspace member not found');
   if(target.role==='ADMIN'&&input.role!=='ADMIN'){
    const admins=await tx.tenantMembership.count({where:{tenantId,role:'ADMIN'}});
    if(admins<=1)throw new ConflictException('A workspace must retain at least one administrator');
   }
   const updated=await tx.tenantMembership.update({where:{id:target.id},data:{role:input.role},include:{user:{select:{id:true,name:true,email:true}}}});
   return {id:updated.id,role:updated.role,user:updated.user};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   await this.audit.record({tenantId,actorId,action:'MEMBER_ROLE_UPDATED',entityType:'TENANT_MEMBERSHIP',metadata:{userId,role:input.role}}); return updated;}
  catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034')throw new ConflictException('Workspace membership changed concurrently; retry the operation');throw error}
 }
 async removeMember(tenantId:string,actorId:string,userId:string){
  if(actorId===userId)throw new ConflictException('You cannot remove your own workspace membership');
  try{const result=await this.prisma.$transaction(async tx=>{
   const target=await tx.tenantMembership.findUnique({where:{userId_tenantId:{userId,tenantId}}});
   if(!target)throw new NotFoundException('Workspace member not found');
   if(target.role==='ADMIN'){
    const admins=await tx.tenantMembership.count({where:{tenantId,role:'ADMIN'}});
    if(admins<=1)throw new ConflictException('A workspace must retain at least one administrator');
   }
   await tx.tenantMembership.delete({where:{id:target.id}});
   return {removed:true,userId};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   await this.audit.record({tenantId,actorId,action:'MEMBER_REMOVED',entityType:'TENANT_MEMBERSHIP',metadata:{userId}}); return result;}
  catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034')throw new ConflictException('Workspace membership changed concurrently; retry the operation');throw error}
 }
}
