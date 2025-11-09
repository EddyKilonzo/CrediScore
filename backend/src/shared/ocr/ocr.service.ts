import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { GoogleVisionOCRService } from './google-vision-ocr.service';
import { extname } from 'path';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

// OCR API Response Types
interface OCRApiResponse {
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string;
  ParsedResults?: OCRParsedResult[];
}

interface OCRParsedResult {
  ParsedText?: string;
  TextOverlay?: {
    Lines?: OCRLine[];
  };
}

interface OCRLine {
  LineText?: string;
  Words?: OCRWord[];
}

interface OCRWord {
  Confidence?: number;
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
}

// OpenAI API Response Types
interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// AI Analysis Response Types
interface AIAnalysisResponse {
  documentType?: string;
  extractedData?: {
    businessName?: string;
    registrationNumber?: string;
    taxNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    issuingAuthority?: string;
    businessAddress?: string;
    ownerName?: string;
    businessType?: string;
  };
  confidence?: number;
  isValid?: boolean;
  validationErrors?: string[];
  securityFeatures?: string[];
  fraudIndicators?: string[];
}

export interface OCRResult {
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
}

export interface DocumentAnalysisResult {
  documentType: string;
  extractedData: {
    businessName?: string;
    registrationNumber?: string;
    taxNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    issuingAuthority?: string;
    businessAddress?: string;
    ownerName?: string;
    businessType?: string;
  };
  confidence: number;
  isValid: boolean;
  validationErrors: string[];
  warnings: string[];
  authenticityScore: number;
  fraudIndicators: string[];
  securityFeatures: string[];
  verificationChecklist: {
    businessNameFound: boolean;
    validRegistrationFormat: boolean;
    validTaxFormat: boolean;
    validIssueDate: boolean;
    validExpiryDate: boolean;
    officialAuthorityPresent: boolean;
    securityFeaturesDetected: boolean;
    noFraudIndicators: boolean;
    validBusinessType: boolean;
    consistentData: boolean;
    recentDocument: boolean;
    properFormatting: boolean;
  };
}

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(
    private readonly googleVisionService: GoogleVisionOCRService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    this.apiKey = this.resolveOcrApiKey();
    this.apiUrl =
      this.configService.get<string>('OCR_API_URL') ||
      process.env.OCR_API_URL ||
      'https://api.ocr.space/parse/image';

    // Log configuration status (without exposing keys)
    this.logger.log(
      `OCR Service initialized - API Key: ${this.apiKey ? 'Configured' : 'Missing'}`,
    );
    this.logger.log(`OCR API URL: ${this.apiUrl}`);
  }

  /**
   * Health check method to verify OCR service configuration
   */
  healthCheck(): {
    status: string;
    message: string;
    configured: boolean;
  } {
    try {
      const hasOcrKey = !!this.apiKey;
      const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
      const googleVisionHealth = this.googleVisionService.healthCheck();

      // Check if at least one OCR service is available
      const hasAnyOcrService = hasOcrKey || googleVisionHealth.configured;

      if (!hasAnyOcrService) {
        return {
          status: 'error',
          message: 'No OCR service configured (OCR.space or Google Vision)',
          configured: false,
        };
      }

      if (!hasOpenAiKey) {
        return {
          status: 'warning',
          message:
            'OpenAI API key not configured - AI analysis will use fallback',
          configured: false,
        };
      }

      const availableServices: string[] = [];
      if (hasOcrKey) availableServices.push('OCR.space');
      if (googleVisionHealth.configured) {
        availableServices.push('Google Vision');
      }

      return {
        status: 'healthy',
        message: `OCR services (${availableServices.join(', ')}) and AI services are properly configured`,
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
   * Extract text from document image using OCR
   */
  async extractText(imageUrl: string, fileType?: string): Promise<OCRResult> {
    try {
      this.logger.log(`Extracting text from image: ${imageUrl}`);

      // Validate API key
      if (!this.apiKey) {
        throw new Error(
          'OCR API key is not configured. Please set OCR_API_KEY (or OCRSPACE_API_KEY) environment variable.',
        );
      }

      // Validate image URL
      if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error('Invalid image URL provided');
      }

      const formData = new FormData();
      formData.append('apikey', this.apiKey);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'true');
      formData.append('detectOrientation', 'true');

      let finalFileType = fileType?.toLowerCase();
      let uploadedAsFile = false;

      try {
        const downloadResult = await this.downloadDocument(
          imageUrl,
          finalFileType,
        );

        if (downloadResult.buffer.length === 0) {
          throw new Error('Downloaded document is empty');
        }

        finalFileType = finalFileType || downloadResult.fileType;
        const contentType =
          downloadResult.contentType ||
          (finalFileType ? this.extensionToMimeType(finalFileType) : undefined);
        const filename = this.ensureFilenameExtension(
          downloadResult.filename,
          finalFileType,
        );

        this.logger.log(
          `Uploading document directly to OCR.space (${filename}, ${downloadResult.buffer.length} bytes)`,
        );

        formData.append('file', downloadResult.buffer, {
          filename,
          contentType,
        });
        uploadedAsFile = true;
      } catch (downloadError) {
        this.logger.warn(
          'Failed to download document for direct upload, falling back to URL parameter',
          downloadError,
        );
        if (!finalFileType) {
          const metadata = this.resolveFileMetadata(imageUrl);
          finalFileType = metadata.fileType;
        }
      }

      if (!uploadedAsFile) {
        formData.append('url', imageUrl);
      }

      // Specify file type if available to help OCR.space detect the file extension
      if (finalFileType) {
        formData.append('filetype', finalFileType);
      }

      const response = await axios.post<OCRApiResponse>(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 60000, // Increased from 30s to 60s for slow networks
      });

      if (response.data.IsErroredOnProcessing) {
        throw new Error(
          `OCR processing failed: ${response.data.ErrorMessage || 'Unknown error'}`,
        );
      }

      const parsedResults = response.data.ParsedResults;
      if (!parsedResults || parsedResults.length === 0) {
        throw new Error('No text found in the document');
      }

      const result = parsedResults[0];
      const extractedText = result.ParsedText || '';
      const lines = result.TextOverlay?.Lines || [];

      const words: OCRWord[] = lines.flatMap(
        (line) => line.Words?.filter((word): word is OCRWord => !!word) || [],
      );
      const validConfidenceValues = words
        .map((word) => word.Confidence)
        .filter(
          (confidence): confidence is number =>
            typeof confidence === 'number' && confidence >= 0,
        );

      let confidence =
        validConfidenceValues.length > 0
          ? validConfidenceValues.reduce((acc, value) => acc + value, 0) /
            validConfidenceValues.length
          : 0;

      if (confidence === 0 && extractedText.trim().length > 0) {
        const normalizedLength = Math.min(
          extractedText.replace(/\s+/g, ' ').trim().length,
          600,
        );

        if (normalizedLength >= 160) {
          confidence = 88;
        } else if (normalizedLength >= 120) {
          confidence = 82;
        } else if (normalizedLength >= 80) {
          confidence = 76;
        } else if (normalizedLength >= 40) {
          confidence = 68;
        } else if (normalizedLength >= 20) {
          confidence = 58;
        } else {
          confidence = 42;
        }

        this.logger.warn(
          'OCR API returned zero confidence scores - estimated confidence derived from text length heuristics',
        );
      }

      const normalizedConfidence = Math.max(0, Math.min(100, confidence));
      const finalConfidence = Math.round(normalizedConfidence);

      // Extract bounding boxes for better analysis
      const boundingBoxes =
        result.TextOverlay?.Lines?.map((line: OCRLine) => {
          const lineWords = line.Words || [];
          const averagedConfidence =
            lineWords.length > 0
              ? Math.round(
                  lineWords.reduce(
                    (acc, word) => acc + (word.Confidence || 0),
                    0,
                  ) / lineWords.length,
                )
              : finalConfidence;
          const referenceWord = lineWords[0];

          return {
            text: line.LineText || '',
            confidence: averagedConfidence,
            coordinates: {
              x: referenceWord?.Left || 0,
              y: referenceWord?.Top || 0,
              width: referenceWord?.Width || 0,
              height: referenceWord?.Height || 0,
            },
          };
        }) || [];

      this.logger.log(
        `Successfully extracted text with confidence: ${confidence}`,
      );

      return {
        text: extractedText,
        confidence: finalConfidence,
        boundingBoxes,
      };
    } catch (error: unknown) {
      this.logger.error('Error extracting text from document:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to extract text from document: ${errorMessage}`);
    }
  }
  private resolveOcrApiKey(): string {
    const candidates = [
      this.configService.get<string>('OCR_API_KEY'),
      this.configService.get<string>('OCRSPACE_API_KEY'),
      process.env.OCR_API_KEY,
      process.env.OCRSPACE_API_KEY,
    ];

    const resolved = candidates.find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );

    if (resolved) {
      return resolved.trim();
    }

    // Provide additional logging hints to help configuration
    this.logger.warn(
      'OCR API key not found in environment. Checked variables: OCR_API_KEY, OCRSPACE_API_KEY.',
    );

    return '';
  }

  /**
   * Extract text from document image using multiple OCR services with fallback
   */
  async extractTextWithFallback(
    imageUrl: string,
    fileType?: string,
  ): Promise<OCRResult> {
    try {
      this.logger.log(`Extracting text from image with fallback: ${imageUrl}`);

      // Validate image URL
      if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error('Invalid image URL provided');
      }

      // Try Google Vision first (if available), then fallback to OCR.space
      const googleVisionHealth = this.googleVisionService.healthCheck();

      if (googleVisionHealth.configured) {
        try {
          this.logger.log('Attempting text extraction with Google Vision API');
          const googleResult =
            await this.googleVisionService.extractText(imageUrl);

          // Check if we got meaningful text
          if (googleResult.text && googleResult.text.trim().length > 0) {
            this.logger.log(
              `Google Vision successfully extracted ${googleResult.text.length} characters`,
            );
            return {
              text: googleResult.text,
              confidence: googleResult.confidence,
              boundingBoxes: googleResult.boundingBoxes?.map((bbox) => ({
                text: bbox.text,
                confidence: bbox.confidence,
                coordinates: bbox.coordinates,
              })),
            };
          }
        } catch (googleError) {
          this.logger.warn(
            'Google Vision extraction failed, falling back to OCR.space:',
            googleError,
          );
        }
      }

      // Fallback to OCR.space with file type
      try {
        const ocrResult = await this.extractText(imageUrl, fileType);
        if (ocrResult.text && ocrResult.text.trim().length > 0) {
          this.logger.log(
            `OCR.space successfully extracted ${ocrResult.text.length} characters`,
          );
          return ocrResult;
        }
      } catch (ocrError) {
        this.logger.warn('OCR.space extraction failed:', ocrError);
        // Don't throw yet, try without file type parameter
      }

      // Last attempt: try OCR.space without file type parameter
      if (fileType) {
        try {
          this.logger.log('Retrying OCR.space without file type parameter...');
          const retryResult = await this.extractText(imageUrl);
          if (retryResult.text && retryResult.text.trim().length > 0) {
            this.logger.log(
              `OCR.space retry successful: ${retryResult.text.length} characters`,
            );
            return retryResult;
          }
        } catch (retryError) {
          this.logger.warn('OCR.space retry also failed:', retryError);
        }
      }

      // If all OCR attempts failed, return minimal result that can still be fraud-checked
      // The fallback analysis will look for fraud keywords in whatever text was extracted
      this.logger.warn(
        'All OCR extraction attempts had low confidence - returning for fallback analysis',
      );
      return {
        text: '', // Empty text will trigger complete failure check in analyzeDocument
        confidence: 0,
        boundingBoxes: [],
      };
    } catch (error: unknown) {
      this.logger.error(
        'Error extracting text from document with fallback:',
        error,
      );
      // Return empty result instead of throwing - let analyzeDocument handle it
      return {
        text: '',
        confidence: 0,
        boundingBoxes: [],
      };
    }
  }

  /**
   * Analyze document content using AI to determine type and extract structured data
   */
  async analyzeDocument(ocrResult: OCRResult): Promise<DocumentAnalysisResult> {
    try {
      this.logger.log('Analyzing document content with AI');

      // Check if OCR completely failed (no text extracted at all)
      const ocrCompletelyFailed =
        !ocrResult.text ||
        ocrResult.text.trim().length < 10 ||
        ocrResult.text.includes('Manual review required') ||
        ocrResult.text.includes('text extraction failed');

      if (ocrCompletelyFailed) {
        this.logger.warn(
          'OCR extraction completely failed - returning result for manual review',
        );
        return {
          documentType: 'UNKNOWN',
          extractedData: {},
          confidence: ocrResult.confidence,
          isValid: true, // Mark as valid to allow upload, but with low score
          validationErrors: [],
          warnings: [
            'Document uploaded successfully but automatic text extraction was unsuccessful.',
            'This document requires manual verification by an administrator.',
            'Please ensure your document is clear, well-lit, and in a supported format (JPEG, PNG, PDF).',
          ],
          authenticityScore: 30, // Low score to indicate manual review needed
          fraudIndicators: [],
          securityFeatures: [],
          verificationChecklist: {
            businessNameFound: false,
            validRegistrationFormat: false,
            validTaxFormat: false,
            validIssueDate: false,
            validExpiryDate: false,
            officialAuthorityPresent: false,
            securityFeaturesDetected: false,
            noFraudIndicators: true,
            validBusinessType: false,
            consistentData: false,
            recentDocument: false,
            properFormatting: false,
          },
        };
      }

      // If we have text, proceed with AI analysis even if confidence is low
      // The validation logic will properly assess the document based on content

      const analysisPrompt = `
        Analyze this business document and extract the following information. IMPORTANT: Be thorough in checking for fraud indicators.
        
        Document Text: ${ocrResult.text}
        
        Please identify:
        1. Document type (Business Registration, Tax Certificate, Trade License, etc.)
        2. Business name
        3. Registration/Tax number
        4. Issue date
        5. Expiry date (if applicable)
        6. Issuing authority
        7. Business address
        8. Owner name
        9. Business type
        10. Security features (seals, stamps, watermarks, holograms, serial numbers)
        11. **CRITICAL**: Fraud indicators - Check for these words: FAKE, SAMPLE, DEMO, TEST, DUMMY, TEMPLATE, DRAFT, COPY, "NOT VALID", "FOR DISPLAY ONLY", SPECIMEN, EXAMPLE, WATERMARK text
        
        For fraud detection:
        - If the document contains words like "FAKE", "SAMPLE", "DEMO", "TEST", "DRAFT", "COPY", "SPECIMEN", "EXAMPLE", or "NOT VALID", this is a FRAUDULENT document
        - If it says "FOR DISPLAY ONLY" or "TEMPLATE", this is NOT a real document
        - Real documents will have official issuing authorities, proper formatting, and authentic security features
        
        Determine if this is a valid, authentic business document. List ALL validation errors and fraud indicators found.
        
        Respond in JSON format with the following structure:
        {
          "documentType": "string",
          "extractedData": {
            "businessName": "string",
            "registrationNumber": "string",
            "taxNumber": "string",
            "issueDate": "string",
            "expiryDate": "string",
            "issuingAuthority": "string",
            "businessAddress": "string",
            "ownerName": "string",
            "businessType": "string"
          },
          "confidence": number (0-100),
          "isValid": boolean,
          "validationErrors": ["string"],
          "securityFeatures": ["string"],
          "fraudIndicators": ["string"]
        }
      `;

      // Use OpenAI API for document analysis
      const openaiResponse = await this.callOpenAI(analysisPrompt);

      try {
        const analysis = JSON.parse(openaiResponse) as AIAnalysisResponse;

        // Perform additional validation checks
        const enrichedExtractedData = {
          ...(analysis.extractedData || {}),
        };

        if (!enrichedExtractedData.registrationNumber) {
          const inferredRegistration = this.extractBusinessRegistrationNumber(
            ocrResult.text,
            enrichedExtractedData.registrationNumber,
          );
          if (inferredRegistration) {
            enrichedExtractedData.registrationNumber = inferredRegistration;
          }
        }

        const validationResult = this.performComprehensiveValidation(
          enrichedExtractedData,
          analysis.fraudIndicators || [],
          analysis.securityFeatures || [],
          ocrResult.confidence,
          analysis.documentType || 'UNKNOWN',
          ocrResult.text,
        );

        const result: DocumentAnalysisResult = {
          documentType: analysis.documentType || 'UNKNOWN',
          extractedData: enrichedExtractedData,
          confidence: analysis.confidence || 0,
          isValid: (analysis.isValid && validationResult.isValid) || false,
          validationErrors: [
            ...(analysis.validationErrors || []),
            ...validationResult.errors,
          ],
          warnings: validationResult.warnings,
          authenticityScore: validationResult.authenticityScore,
          fraudIndicators: analysis.fraudIndicators || [],
          securityFeatures: analysis.securityFeatures || [],
          verificationChecklist: validationResult.checklist,
        };

        this.logger.log(
          `Document analysis completed - Type: ${result.documentType}, Score: ${result.authenticityScore}, Valid: ${result.isValid}`,
        );

        return result;
      } catch {
        this.logger.warn(
          'Failed to parse AI analysis response, using fallback',
        );
        return this.fallbackDocumentAnalysis(
          ocrResult.text,
          ocrResult.confidence,
        );
      }
    } catch (error) {
      this.logger.error('Error analyzing document:', error);
      return this.fallbackDocumentAnalysis(
        ocrResult.text,
        ocrResult.confidence,
      );
    }
  }

  /**
   * Call OpenAI API for document analysis
   */
  private async callOpenAI(prompt: string): Promise<string> {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        this.logger.error('OpenAI API key not configured');
        throw new Error(
          'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.',
        );
      }

      this.logger.log('Calling OpenAI API for document analysis');

      const response = await axios.post<OpenAIResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert document analyst specializing in business document verification. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.1,
        },
        {
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // Increased from 30s to 60s for slow networks
        },
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive document validation with enhanced security checks
   */
  private performComprehensiveValidation(
    extractedData: {
      businessName?: string;
      registrationNumber?: string;
      taxNumber?: string;
      issueDate?: string;
      expiryDate?: string;
      issuingAuthority?: string;
      businessAddress?: string;
      ownerName?: string;
      businessType?: string;
    },
    fraudIndicators: string[],
    securityFeatures: string[],
    ocrConfidence: number,
    documentType: string = 'UNKNOWN',
    documentText: string = '',
  ): {
    isValid: boolean;
    authenticityScore: number;
    errors: string[];
    warnings: string[];
    checklist: {
      businessNameFound: boolean;
      validRegistrationFormat: boolean;
      validTaxFormat: boolean;
      validIssueDate: boolean;
      validExpiryDate: boolean;
      officialAuthorityPresent: boolean;
      securityFeaturesDetected: boolean;
      noFraudIndicators: boolean;
      validBusinessType: boolean;
      consistentData: boolean;
      recentDocument: boolean;
      properFormatting: boolean;
    };
  } {
    const normalizedDocumentType =
      typeof documentType === 'string' ? documentType.toUpperCase() : 'UNKNOWN';
    const isBusinessRegistration = normalizedDocumentType.includes('BUSINESS');
    const isTaxCertificate = normalizedDocumentType.includes('TAX');

    const errors: string[] = [];
    const warnings: string[] = [];
    let authenticityScore = 30; // Base score for minimal checks
    const checklist = {
      businessNameFound: false,
      validRegistrationFormat: false,
      validTaxFormat: false,
      validIssueDate: false,
      validExpiryDate: false,
      officialAuthorityPresent: false,
      securityFeaturesDetected: false,
      noFraudIndicators: false,
      validBusinessType: false,
      consistentData: false,
      recentDocument: false,
      properFormatting: false,
    };

    // Business name check
    const businessName = extractedData.businessName?.trim();
    if (businessName) {
      checklist.businessNameFound = true;
      checklist.properFormatting = true;
      authenticityScore += 35;
    } else {
      errors.push('Business name not found in document');
    }

    // Registration number check (presence or inferred)
    let registrationNumber = extractedData.registrationNumber?.trim();
    if (!registrationNumber) {
      const inferredRegistration = this.extractBusinessRegistrationNumber(
        documentText,
        extractedData.registrationNumber,
      );
      if (inferredRegistration) {
        registrationNumber = inferredRegistration;
        extractedData.registrationNumber = inferredRegistration;
      }
    }

    if (registrationNumber) {
      checklist.validRegistrationFormat = true;
      authenticityScore += 35;
    } else if (isBusinessRegistration || isTaxCertificate) {
      errors.push('Registration number not found in document');
    } else if (extractedData.taxNumber?.trim()) {
      // For non-registration docs, tax number counts toward checklist
      checklist.validRegistrationFormat = true;
      authenticityScore += 20;
    }

    // Optional tax number bonus (no strict format)
    if (extractedData.taxNumber && extractedData.taxNumber.trim().length > 0) {
      checklist.validTaxFormat = true;
      authenticityScore += 10;
    }

    // Kenyan official marker check
    const hasKenyanMarker = this.detectKenyanAuthorityMarker(
      documentText,
      extractedData.issuingAuthority,
    );
    if (hasKenyanMarker) {
      checklist.officialAuthorityPresent = true;
      authenticityScore += 20;
    } else {
      warnings.push(
        'Official Kenyan authority markers not detected (e.g., Republic of Kenya, Business Registration Service)',
      );
    }

    // Fraud indicators are still hard blockers
    if (fraudIndicators.length === 0) {
      checklist.noFraudIndicators = true;
      authenticityScore += 5;
    } else {
      errors.push(`Fraud indicators detected: ${fraudIndicators.join(', ')}`);
      authenticityScore = Math.max(0, authenticityScore - 40);
    }

    // OCR confidence contributes slightly
    if (ocrConfidence > 80) {
      authenticityScore += 10;
    } else if (ocrConfidence < 40) {
      warnings.push(
        'Low OCR confidence - consider re-uploading a clearer copy',
      );
      authenticityScore -= 5;
    }

    // Ensure score is between 0 and 100
    authenticityScore = Math.max(0, Math.min(100, authenticityScore));

    const isAuthentic =
      errors.length === 0 && hasKenyanMarker && authenticityScore >= 60;

    return {
      isValid: isAuthentic,
      authenticityScore: Math.round(authenticityScore),
      errors,
      warnings,
      checklist,
    };
  }

  /**
   * Fallback document analysis using pattern matching
   */
  private fallbackDocumentAnalysis(
    text: string,
    ocrConfidence: number = 0,
  ): DocumentAnalysisResult {
    const upperText = text.toUpperCase();
    const fraudIndicators: string[] = [];
    const securityFeatures: string[] = [];

    // Check for fraud indicators FIRST
    const fraudPatterns = [
      { pattern: /FAKE/i, indicator: 'Contains word "FAKE"' },
      { pattern: /SAMPLE/i, indicator: 'Contains word "SAMPLE"' },
      { pattern: /DEMO/i, indicator: 'Contains word "DEMO"' },
      { pattern: /TEST/i, indicator: 'Contains word "TEST"' },
      { pattern: /DUMMY/i, indicator: 'Contains word "DUMMY"' },
      { pattern: /TEMPLATE/i, indicator: 'Contains word "TEMPLATE"' },
      { pattern: /DRAFT/i, indicator: 'Contains word "DRAFT"' },
      { pattern: /COPY/i, indicator: 'Contains word "COPY"' },
      { pattern: /NOT\s+VALID/i, indicator: 'Contains "NOT VALID"' },
      {
        pattern: /FOR\s+DISPLAY\s+ONLY/i,
        indicator: 'Contains "FOR DISPLAY ONLY"',
      },
      { pattern: /SPECIMEN/i, indicator: 'Contains word "SPECIMEN"' },
      { pattern: /EXAMPLE/i, indicator: 'Contains word "EXAMPLE"' },
      {
        pattern: /WATERMARK/i,
        indicator: 'Contains word "WATERMARK" (suspicious)',
      },
    ];

    fraudPatterns.forEach(({ pattern, indicator }) => {
      if (pattern.test(text)) {
        fraudIndicators.push(indicator);
      }
    });

    // Check for security features
    const securityPatterns = [
      { pattern: /SEAL/i, feature: 'Official seal mentioned' },
      { pattern: /STAMP/i, feature: 'Official stamp mentioned' },
      { pattern: /SIGNATURE/i, feature: 'Signature present' },
      { pattern: /HOLOGRAM/i, feature: 'Hologram mentioned' },
      { pattern: /EMBOSSED/i, feature: 'Embossed text present' },
      { pattern: /SERIAL\s+NUMBER/i, feature: 'Serial number present' },
      { pattern: /BARCODE/i, feature: 'Barcode present' },
      { pattern: /QR\s+CODE/i, feature: 'QR code present' },
    ];

    securityPatterns.forEach(({ pattern, feature }) => {
      if (pattern.test(text)) {
        securityFeatures.push(feature);
      }
    });

    // Determine document type based on keywords
    let documentType = 'UNKNOWN';
    if (
      upperText.includes('BUSINESS REGISTRATION') ||
      upperText.includes('CERTIFICATE OF INCORPORATION')
    ) {
      documentType = 'BUSINESS_REGISTRATION';
    } else if (
      upperText.includes('TAX CERTIFICATE') ||
      upperText.includes('TAX COMPLIANCE')
    ) {
      documentType = 'TAX_CERTIFICATE';
    } else if (
      upperText.includes('TRADE LICENSE') ||
      upperText.includes('BUSINESS LICENSE')
    ) {
      documentType = 'TRADE_LICENSE';
    }

    // Extract basic information using regex patterns
    const businessNameMatch = text.match(
      /(?:business name|company name|name of business)[:\s]+([^\n\r]+)/i,
    );
    const registrationMatch = text.match(
      /(?:registration number|reg no|reg\. no)[:\s]+([A-Z0-9-/]+)/i,
    );
    const taxMatch = text.match(
      /(?:tax number|tax no|tax\. no|pin)[:\s]+([A-Z0-9-/]+)/i,
    );
    const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g);
    const authorityMatch = text.match(
      /(?:issued by|issuing authority|authorized by)[:\s]+([^\n\r]+)/i,
    );

    const extractedData = {
      businessName: businessNameMatch?.[1]?.trim(),
      registrationNumber: registrationMatch?.[1]?.trim(),
      taxNumber: taxMatch?.[1]?.trim(),
      issueDate: dateMatch?.[0],
      expiryDate: dateMatch?.[1],
      issuingAuthority: authorityMatch?.[1]?.trim(),
    };

    if (!extractedData.registrationNumber) {
      const inferredRegistration = this.extractBusinessRegistrationNumber(
        text,
        extractedData.registrationNumber,
      );
      if (inferredRegistration) {
        extractedData.registrationNumber = inferredRegistration;
      }
    }

    // Basic validation
    const validationErrors: string[] = [];
    if (!extractedData.businessName) {
      validationErrors.push('Business name not found');
    }
    if (!extractedData.registrationNumber && !extractedData.taxNumber) {
      validationErrors.push('Registration or tax number not found');
    }

    // Perform validation for fallback
    const validationResult = this.performComprehensiveValidation(
      extractedData,
      fraudIndicators,
      securityFeatures,
      ocrConfidence,
      documentType,
      text,
    );

    return {
      documentType,
      extractedData,
      confidence: 50, // Lower confidence for fallback
      isValid:
        validationErrors.length === 0 &&
        validationResult.isValid &&
        fraudIndicators.length === 0,
      validationErrors: [...validationErrors, ...validationResult.errors],
      warnings: validationResult.warnings,
      authenticityScore: validationResult.authenticityScore,
      fraudIndicators,
      securityFeatures,
      verificationChecklist: validationResult.checklist,
    };
  }

  /**
   * Verify document authenticity using AI
   */
  verifyDocumentAuthenticity(
    ocrResult: OCRResult,
    analysisResult: DocumentAnalysisResult,
  ): {
    isAuthentic: boolean;
    confidence: number;
    reasons: string[];
  } {
    try {
      this.logger.log('Verifying document authenticity');

      // Use the authenticity score from analysis result
      const authenticityScore = analysisResult.authenticityScore;
      const isAuthentic = authenticityScore >= 60;

      const reasons: string[] = [];

      // Add reasons based on checklist
      if (analysisResult.verificationChecklist.businessNameFound) {
        reasons.push('Business name verified');
      }
      if (analysisResult.verificationChecklist.validRegistrationFormat) {
        reasons.push('Valid registration number format');
      }
      if (analysisResult.verificationChecklist.validTaxFormat) {
        reasons.push('Valid tax number format');
      }
      if (analysisResult.verificationChecklist.officialAuthorityPresent) {
        reasons.push('Official authority verified');
      }
      if (analysisResult.verificationChecklist.securityFeaturesDetected) {
        reasons.push('Security features detected');
      }
      if (analysisResult.verificationChecklist.noFraudIndicators) {
        reasons.push('No fraud indicators found');
      }

      // Add negative reasons
      if (analysisResult.fraudIndicators.length > 0) {
        reasons.push(
          `Fraud indicators: ${analysisResult.fraudIndicators.join(', ')}`,
        );
      }
      if (analysisResult.validationErrors.length > 0) {
        reasons.push(
          `Validation errors: ${analysisResult.validationErrors.join(', ')}`,
        );
      }

      this.logger.log(
        `Document authenticity verification completed - Score: ${authenticityScore}, Authentic: ${isAuthentic}`,
      );

      return {
        isAuthentic,
        confidence: authenticityScore,
        reasons,
      };
    } catch (error) {
      this.logger.error('Error verifying document authenticity:', error);
      return this.fallbackAuthenticityVerification(ocrResult, analysisResult);
    }
  }

  /**
   * Fallback authenticity verification
   */
  private fallbackAuthenticityVerification(
    ocrResult: OCRResult,
    analysisResult: DocumentAnalysisResult,
  ): {
    isAuthentic: boolean;
    confidence: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let confidence = 50;

    // Check OCR confidence
    if (ocrResult.confidence > 80) {
      confidence += 20;
      reasons.push('High OCR confidence');
    } else if (ocrResult.confidence < 50) {
      confidence -= 20;
      reasons.push('Low OCR confidence');
    }

    // Check document completeness
    if (analysisResult.isValid) {
      confidence += 15;
      reasons.push('Document contains required information');
    } else {
      confidence -= 15;
      reasons.push('Document missing required information');
    }

    // Check for official elements
    const text = ocrResult.text.toUpperCase();
    if (
      text.includes('SEAL') ||
      text.includes('STAMP') ||
      text.includes('OFFICIAL')
    ) {
      confidence += 10;
      reasons.push('Contains official elements');
    }

    // Check for suspicious patterns
    if (
      text.includes('FAKE') ||
      text.includes('COPY') ||
      text.includes('SAMPLE')
    ) {
      confidence -= 30;
      reasons.push('Contains suspicious keywords');
    }

    return {
      isAuthentic: confidence > 60,
      confidence: Math.max(0, Math.min(100, confidence)),
      reasons,
    };
  }
  private async downloadDocument(
    imageUrl: string,
    providedFileType?: string,
  ): Promise<{
    buffer: Buffer;
    filename: string;
    fileType?: string;
    contentType?: string;
  }> {
    let response: AxiosResponse<ArrayBuffer>;
    try {
      response = await this.fetchDocumentWithRetry(imageUrl);
    } catch (error) {
      if (this.shouldRetryWithSignedCloudinaryUrl(imageUrl, error)) {
        const signedUrl = this.getSignedCloudinaryUrl(imageUrl);
        if (!signedUrl) {
          throw error;
        }
        this.logger.log(
          'Cloudinary download requires signed access - retrying with authenticated URL',
        );
        response = await this.fetchDocumentWithRetry(signedUrl);
      } else {
        throw error;
      }
    }
    let buffer = Buffer.from(response.data);
    let rawContentType: unknown = response.headers['content-type'];
    let contentType = this.normalizeHeaderValue(rawContentType);

    if (buffer.length === 0 && this.isCloudinaryUrl(imageUrl)) {
      const signedUrl = this.getSignedCloudinaryUrl(imageUrl);
      if (signedUrl) {
        this.logger.log(
          'Cloudinary download returned empty data - retrying with authenticated URL',
        );
        const signedResponse = await this.fetchDocumentWithRetry(signedUrl);
        buffer = Buffer.from(signedResponse.data);
        rawContentType = signedResponse.headers['content-type'];
        contentType = this.normalizeHeaderValue(rawContentType);
      }
    }

    const { filename, fileType } = this.resolveFileMetadata(
      imageUrl,
      providedFileType,
      contentType,
    );

    return {
      buffer,
      filename,
      fileType,
      contentType,
    };
  }

  private resolveFileMetadata(
    imageUrl: string,
    providedFileType?: string,
    contentType?: string,
  ): {
    filename: string;
    fileType?: string;
  } {
    let detectedFileType = providedFileType;
    let filename = 'document';

    try {
      const url = new URL(imageUrl);
      const pathname = url.pathname;
      const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (lastSegment) {
        filename = decodeURIComponent(lastSegment.split('?')[0]) || filename;
      }

      if (!detectedFileType) {
        const extension = extname(pathname).replace('.', '').toLowerCase();
        if (extension) {
          detectedFileType = extension;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse document URL for metadata', error);
    }

    if (!detectedFileType && contentType) {
      detectedFileType = this.mimeTypeToExtension(contentType);
    }

    return {
      filename,
      fileType: detectedFileType,
    };
  }

  private async fetchDocumentWithRetry(
    url: string,
  ): Promise<AxiosResponse<ArrayBuffer>> {
    return axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        Accept: '*/*',
      },
      maxContentLength: 25 * 1024 * 1024,
      validateStatus: (status) => status >= 200 && status < 400,
    });
  }

  private shouldRetryWithSignedCloudinaryUrl(
    originalUrl: string,
    error: unknown,
  ): boolean {
    if (!this.isCloudinaryUrl(originalUrl)) {
      return false;
    }

    if (!axios.isAxiosError(error)) {
      return false;
    }

    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return true;
    }

    const rawHeader: unknown = error.response?.headers?.['x-cld-error'];
    const normalizedHeader = this.normalizeHeaderValue(rawHeader);
    if (normalizedHeader && /deny|acl|unauthorized/i.test(normalizedHeader)) {
      return true;
    }

    return false;
  }

  private getSignedCloudinaryUrl(originalUrl: string): string | null {
    try {
      return this.cloudinaryService.generateAuthenticatedDownloadUrlFromAssetUrl(
        originalUrl,
      );
    } catch (error) {
      this.logger.warn(
        'Failed to generate signed Cloudinary URL for document download',
        error,
      );
      return null;
    }
  }

  private isCloudinaryUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith('cloudinary.com');
    } catch {
      return false;
    }
  }

  private mimeTypeToExtension(mimeType: string): string | undefined {
    const mapping: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/tiff': 'tiff',
      'image/bmp': 'bmp',
      'image/gif': 'gif',
    };

    return mapping[mimeType.toLowerCase()];
  }

  private extensionToMimeType(extension?: string): string | undefined {
    if (!extension) {
      return undefined;
    }

    const mapping: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      tiff: 'image/tiff',
      tif: 'image/tiff',
      bmp: 'image/bmp',
      gif: 'image/gif',
    };

    return mapping[extension.toLowerCase()];
  }

  private ensureFilenameExtension(
    filename: string,
    extension?: string,
  ): string {
    if (!extension) {
      return filename;
    }

    const normalizedExtension = extension.toLowerCase();
    if (filename.toLowerCase().endsWith(`.${normalizedExtension}`)) {
      return filename;
    }

    return `${filename}.${normalizedExtension}`;
  }

  private normalizeHeaderValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      const firstString = value.find(
        (item): item is string => typeof item === 'string',
      );
      return firstString;
    }

    return undefined;
  }

  private detectKenyanAuthorityMarker(
    documentText: string,
    issuingAuthority?: string,
  ): boolean {
    const combinedText = `${issuingAuthority ?? ''} ${documentText ?? ''}`;
    const upper = combinedText.toUpperCase();

    const markers = [
      'REPUBLIC OF KENYA',
      'BUSINESS REGISTRATION SERVICE',
      'REGISTRAR OF COMPANIES',
      'MINISTRY OF INDUSTRIALIZATION',
      'MINISTRY OF TRADE',
      'STATE DEPARTMENT FOR INDUSTRY',
      'STATE DEPARTMENT FOR COOPERATIVES',
      'KENYA REVENUE AUTHORITY',
      'KRA',
      'COUNTY GOVERNMENT OF',
      'THE NATIONAL TREASURY',
      'THE REGISTRATION OF BUSINESS NAMES ACT',
      'CAP 499',
    ];

    return markers.some((marker) => upper.includes(marker));
  }

  private extractBusinessRegistrationNumber(
    documentText: string,
    existingRegistration?: string,
  ): string | null {
    if (existingRegistration && existingRegistration.trim().length > 0) {
      return existingRegistration.trim();
    }

    if (!documentText) {
      return null;
    }

    const patterns: Array<RegExp> = [
      /BUSINESS\s+NO[:\s-]*(BN-[A-Z0-9]+)/i,
      /BUSINESS\s+NUMBER[:\s-]*(BN-[A-Z0-9]+)/i,
      /REGISTRATION\s+NO[:\s-]*(BN-[A-Z0-9]+)/i,
      /\b(BN-[A-Z0-9]{3,})\b/i,
    ];

    for (const pattern of patterns) {
      const match = documentText.match(pattern);
      if (match?.[1]) {
        return match[1].toUpperCase();
      }
    }

    return null;
  }

  private parseFlexibleDate(dateString?: string): Date | null {
    if (!dateString) {
      return null;
    }

    const cleaned = dateString
      .trim()
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/\s+/g, ' ');

    if (!cleaned) {
      return null;
    }

    const direct = new Date(cleaned);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const normalizedSeparators = cleaned.replace(/[/.]/g, '-');
    const parts = normalizedSeparators
      .split('-')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length !== 3) {
      return null;
    }

    const [p1, p2, p3] = parts.map((part) => Number.parseInt(part, 10));
    const combos: Array<[number, number, number]> = [];

    if (parts[0].length === 4 && !Number.isNaN(p1)) {
      combos.push([p1, p2, p3]);
    }
    if (parts[2].length === 4 && !Number.isNaN(p3)) {
      combos.push([p3, p2, p1]);
      combos.push([p3, p1, p2]);
    }
    if (combos.length === 0) {
      combos.push([p3, p2, p1]);
      combos.push([p1, p2, p3]);
    }

    for (const [year, month, day] of combos) {
      if (
        Number.isNaN(year) ||
        Number.isNaN(month) ||
        Number.isNaN(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        continue;
      }

      const candidate = new Date(year, month - 1, day);
      if (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
      ) {
        return candidate;
      }
    }

    return null;
  }
}
