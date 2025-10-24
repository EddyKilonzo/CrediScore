import { Module } from '@nestjs/common';
import { GoogleVisionOCRService } from './google-vision-ocr.service';

@Module({
  providers: [GoogleVisionOCRService],
  exports: [GoogleVisionOCRService],
})
export class GoogleVisionOCRModule {}
