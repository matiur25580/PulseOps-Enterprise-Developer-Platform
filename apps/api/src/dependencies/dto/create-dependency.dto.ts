import { IsUUID } from 'class-validator';
export class CreateDependencyDto {
  @IsUUID() sourceServiceId!: string;
  @IsUUID() targetServiceId!: string;
}
