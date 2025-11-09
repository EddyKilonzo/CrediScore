import { Module } from '@nestjs/common';
import { OCRService } from './ocr.service';
import { GoogleVisionOCRModule } from './google-vision-ocr.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [GoogleVisionOCRModule, CloudinaryModule],
  providers: [OCRService],
  exports: [OCRService],
})
export class OCRModule {}
