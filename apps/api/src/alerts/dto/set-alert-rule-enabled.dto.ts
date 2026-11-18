import { IsBoolean } from 'class-validator';
export class SetAlertRuleEnabledDto {
  @IsBoolean() enabled!: boolean;
}
