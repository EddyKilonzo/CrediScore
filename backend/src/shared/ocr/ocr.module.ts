import { Module } from '@nestjs/common';
import { OCRService } from './ocr.service';
import { GoogleVisionOCRModule } from './google-vision-ocr.module';

@Module({
  imports: [GoogleVisionOCRModule],
  providers: [OCRService],
  exports: [OCRService],
})
export class OCRModule {}
