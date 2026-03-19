import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateResponseTemplateDto {
  @ApiProperty({ description: 'Template name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Template content' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Set as default template', required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateResponseTemplateDto {
  @ApiProperty({ description: 'Template name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Template content', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: 'Set as default template', required: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
