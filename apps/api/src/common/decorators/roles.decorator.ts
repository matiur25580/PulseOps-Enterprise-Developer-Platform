import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY='pulseops:roles';
export type AppRole='ADMIN'|'MEMBER';
export const Roles=(...roles:AppRole[])=>SetMetadata(ROLES_KEY,roles);
