import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Google Vision API Response Types
interface GoogleVisionTextAnnotation {
  text?: string;
  boundingPoly?: {
    vertices?: Array<{
      x?: number;
      y?: number;
    }>;
  };
}

export interface GoogleVisionOCRResult {
  text: string;
  confidence: number;
  boundingBoxes?: Array<{
    text: string;
    confidence: number;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  detectedLanguages?: Array<{
    language: string;
    confidence: number;
  }>;
}

@Injectable()
export class GoogleVisionOCRService {
  private readonly logger = new Logger(GoogleVisionOCRService.name);
  private readonly client: ImageAnnotatorClient | null;
  private readonly projectId: string;
  private readonly keyFilename: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    this.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

    // Initialize Google Vision client only if credentials are provided
    if (this.projectId && this.keyFilename) {
      try {
        this.client = new ImageAnnotatorClient({
          projectId: this.projectId,
          keyFilename: this.keyFilename,
        });
        this.logger.log('Google Vision API client initialized successfully');
      } catch (error) {
        this.logger.warn(
          'Failed to initialize Google Vision API client - service will not be available:',
          error instanceof Error ? error.message : error,
        );
        // Don't throw error - allow service to continue without Google Vision
        this.client = null;
      }
    } else {
      this.logger.log('Google Vision API credentials not configured - service will use fallback options');
      this.client = null;
    }
  }

  /**
   * Health check method to verify Google Vision service configuration
   */
  healthCheck(): {
    status: string;
    message: string;
    configured: boolean;
  } {
    try {
      const hasProjectId = !!this.projectId;
      const hasKeyFile = !!this.keyFilename;
      const hasClient = !!this.client && this.client !== null;

      if (!hasProjectId) {
        return {
          status: 'error',
          message: 'Google Cloud Project ID not configured',
          configured: false,
        };
      }

      if (!hasKeyFile) {
        return {
          status: 'error',
          message: 'Google Application Credentials not configured',
          configured: false,
        };
      }

      if (!hasClient) {
        return {
          status: 'error',
          message: 'Google Vision client not initialized',
          configured: false,
        };
      }

      return {
        status: 'healthy',
        message: 'Google Vision API is properly configured',
        configured: true,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        configured: false,
      };
    }
  }

  /**
   * Extract text from document image using Google Vision API
   */
  async extractText(imageUrl: string): Promise<GoogleVisionOCRResult> {
    try {
      // Check if client is available
      if (!this.client) {
        throw new Error('Google Vision client not initialized - credentials not configured');
      }

      this.logger.log(
        `Extracting text from image using Google Vision: ${imageUrl}`,
      );

      // Validate image URL
      if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error('Invalid image URL provided');
      }

      // Perform text detection
      const [result] = await this.client.textDetection(imageUrl);
      const annotations =
        result.textAnnotations as GoogleVisionTextAnnotation[];

      if (!annotations || annotations.length === 0) {
        throw new Error('No text found in the document');
      }

      // Extract full text (first annotation contains all text)
      const fullText = annotations[0].text || '';

      // Extract bounding boxes for individual text blocks
      const boundingBoxes = annotations.slice(1).map((annotation) => {
        const text = annotation.text || '';
        const vertices = annotation.boundingPoly?.vertices || [];

        if (vertices.length >= 2) {
          const x = vertices[0].x || 0;
          const y = vertices[0].y || 0;
          const width = (vertices[1].x || 0) - x;
          const height = (vertices[2].y || 0) - y;

          return {
            text,
            confidence: 95, // Google Vision doesn't provide confidence scores for text detection
            coordinates: { x, y, width, height },
          };
        }

        return {
          text,
          confidence: 95,
          coordinates: { x: 0, y: 0, width: 0, height: 0 },
        };
      });

      // Extract detected languages
      const detectedLanguages =
        result.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.map(
          (lang) => ({
            language: lang.languageCode || 'unknown',
            confidence: lang.confidence || 0,
          }),
        ) || [];

      // Calculate overall confidence (Google Vision doesn't provide text confidence, so we estimate)
      const estimatedConfidence = fullText.length > 50 ? 95 : 85;

      this.logger.log(
        `Successfully extracted text with Google Vision - Confidence: ${estimatedConfidence}%, Text length: ${fullText.length}`,
      );

      return {
        text: fullText,
        confidence: estimatedConfidence,
        boundingBoxes,
        detectedLanguages,
      };
    } catch (error: unknown) {
      this.logger.error('Error extracting text with Google Vision:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to extract text with Google Vision: ${errorMessage}`,
      );
    }
  }

  /**
   * Extract text from local file buffer using Google Vision API
   */
  async extractTextFromBuffer(buffer: Buffer): Promise<GoogleVisionOCRResult> {
    try {
      // Check if client is available
      if (!this.client) {
        throw new Error('Google Vision client not initialized - credentials not configured');
      }

      this.logger.log(`Extracting text from buffer using Google Vision`);

      // Perform text detection on buffer
      const [result] = await this.client.textDetection({
        image: {
          content: buffer,
        },
        imageContext: {
          languageHints: ['en'],
        },
      });

      const annotations =
        result.textAnnotations as GoogleVisionTextAnnotation[];

      if (!annotations || annotations.length === 0) {
        throw new Error('No text found in the document');
      }

      // Extract full text (first annotation contains all text)
      const fullText = annotations[0].text || '';

      // Extract bounding boxes for individual text blocks
      const boundingBoxes = annotations.slice(1).map((annotation) => {
        const text = annotation.text || '';
        const vertices = annotation.boundingPoly?.vertices || [];

        if (vertices.length >= 2) {
          const x = vertices[0].x || 0;
          const y = vertices[0].y || 0;
          const width = (vertices[1].x || 0) - x;
          const height = (vertices[2].y || 0) - y;

          return {
            text,
            confidence: 95,
            coordinates: { x, y, width, height },
          };
        }

        return {
          text,
          confidence: 95,
          coordinates: { x: 0, y: 0, width: 0, height: 0 },
        };
      });

      // Extract detected languages
      const detectedLanguages =
        result.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.map(
          (lang) => ({
            language: lang.languageCode || 'unknown',
            confidence: lang.confidence || 0,
          }),
        ) || [];

      // Calculate overall confidence
      const estimatedConfidence = fullText.length > 50 ? 95 : 85;

      this.logger.log(
        `Successfully extracted text from buffer with Google Vision - Confidence: ${estimatedConfidence}%, Text length: ${fullText.length}`,
      );

      return {
        text: fullText,
        confidence: estimatedConfidence,
        boundingBoxes,
        detectedLanguages,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error extracting text from buffer with Google Vision:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(
        `Failed to extract text from buffer with Google Vision: ${errorMessage}`,
      );
    }
  }

  /**
   * Detect document type using Google Vision API
   */
  async detectDocumentType(imageUrl: string): Promise<{
    documentType: string;
    confidence: number;
    features: string[];
  }> {
    try {
      // Check if client is available
      if (!this.client) {
        return {
          documentType: 'UNKNOWN',
          confidence: 0,
          features: [],
        };
      }

      this.logger.log(
        `Detecting document type using Google Vision: ${imageUrl}`,
      );

      // Perform document text detection
      const [result] = await this.client.documentTextDetection(imageUrl);
      const fullTextAnnotation = result.fullTextAnnotation;

      if (!fullTextAnnotation?.text) {
        return {
          documentType: 'UNKNOWN',
          confidence: 0,
          features: [],
        };
      }

      const text = fullTextAnnotation.text.toUpperCase();
      const features: string[] = [];

      // Detect document type based on keywords
      let documentType = 'UNKNOWN';
      let confidence = 50;

      if (
        text.includes('BUSINESS REGISTRATION') ||
        text.includes('CERTIFICATE OF INCORPORATION')
      ) {
        documentType = 'BUSINESS_REGISTRATION';
        confidence = 90;
        features.push('business_registration_keywords');
      } else if (
        text.includes('TAX CERTIFICATE') ||
        text.includes('TAX COMPLIANCE')
      ) {
        documentType = 'TAX_CERTIFICATE';
        confidence = 90;
        features.push('tax_certificate_keywords');
      } else if (
        text.includes('TRADE LICENSE') ||
        text.includes('BUSINESS LICENSE')
      ) {
        documentType = 'TRADE_LICENSE';
        confidence = 85;
        features.push('trade_license_keywords');
      }

      // Detect additional features
      if (text.includes('SEAL') || text.includes('STAMP')) {
        features.push('official_seal');
        confidence += 5;
      }

      if (text.includes('SIGNATURE')) {
        features.push('signature');
        confidence += 5;
      }

      if (text.includes('DATE') || text.includes('ISSUED')) {
        features.push('date_issued');
        confidence += 5;
      }

      this.logger.log(
        `Document type detected: ${documentType} with confidence: ${confidence}%`,
      );

      return {
        documentType,
        confidence: Math.min(confidence, 100),
        features,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error detecting document type with Google Vision:',
        error,
      );
      return {
        documentType: 'UNKNOWN',
        confidence: 0,
        features: [],
      };
    }
  }
}
