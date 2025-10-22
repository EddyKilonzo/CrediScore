import { Module } from '@nestjs/common';
import { OCRService } from './ocr.service';

@Module({
  providers: [OCRService],
  exports: [OCRService],
})
export class OCRModule {}
