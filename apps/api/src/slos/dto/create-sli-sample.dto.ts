import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
export class CreateSliSampleDto {
  @IsBoolean() success!: boolean;
  @IsOptional() @IsInt() @Min(0) latencyMs?: number;
}
