import { IsUUID, Matches, MaxLength } from 'class-validator';
export class CreateGitHubRepositoryDto {
  @Matches(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, { message: 'repositoryFullName must use owner/repository format' })
  @MaxLength(200)
  repositoryFullName!: string;
  @IsUUID()
  serviceId!: string;
}
