import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import { GoogleVisionOCRService } from './google-vision-ocr.service';

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

  constructor(private readonly googleVisionService: GoogleVisionOCRService) {
    this.apiKey = process.env.OCR_API_KEY || '';
    this.apiUrl =
      process.env.OCR_API_URL || 'https://api.ocr.space/parse/image';

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
  async extractText(imageUrl: string): Promise<OCRResult> {
    try {
      this.logger.log(`Extracting text from image: ${imageUrl}`);

      // Validate API key
      if (!this.apiKey) {
        throw new Error(
          'OCR API key is not configured. Please set OCR_API_KEY environment variable.',
        );
      }

      // Validate image URL
      if (!imageUrl || !imageUrl.startsWith('http')) {
        throw new Error('Invalid image URL provided');
      }

      const formData = new FormData();
      formData.append('url', imageUrl);
      formData.append('apikey', this.apiKey);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'true');
      formData.append('detectOrientation', 'true');

      const response = await axios.post<OCRApiResponse>(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000,
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
      const confidence =
        lines.length > 0
          ? lines.reduce(
              (acc: number, line: OCRLine) =>
                acc + (line.Words?.[0]?.Confidence || 0),
              0,
            ) / lines.length
          : 0;

      // Extract bounding boxes for better analysis
      const boundingBoxes =
        result.TextOverlay?.Lines?.map((line: OCRLine) => ({
          text: line.LineText || '',
          confidence: line.Words?.[0]?.Confidence || 0,
          coordinates: {
            x: line.Words?.[0]?.Left || 0,
            y: line.Words?.[0]?.Top || 0,
            width: line.Words?.[0]?.Width || 0,
            height: line.Words?.[0]?.Height || 0,
          },
        })) || [];

      this.logger.log(
        `Successfully extracted text with confidence: ${confidence}`,
      );

      return {
        text: extractedText,
        confidence: Math.round(confidence),
        boundingBoxes,
      };
    } catch (error: unknown) {
      this.logger.error('Error extracting text from document:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to extract text from document: ${errorMessage}`);
    }
  }

  /**
   * Extract text from document image using multiple OCR services with fallback
   */
  async extractTextWithFallback(imageUrl: string): Promise<OCRResult> {
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

          // Convert Google Vision result to OCRResult format
          return {
            text: googleResult.text,
            confidence: googleResult.confidence,
            boundingBoxes: googleResult.boundingBoxes?.map((bbox) => ({
              text: bbox.text,
              confidence: bbox.confidence,
              coordinates: bbox.coordinates,
            })),
          };
        } catch (googleError) {
          this.logger.warn(
            'Google Vision extraction failed, falling back to OCR.space:',
            googleError,
          );
        }
      }

      // Fallback to OCR.space
      return await this.extractText(imageUrl);
    } catch (error: unknown) {
      this.logger.error(
        'Error extracting text from document with fallback:',
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to extract text from document: ${errorMessage}`);
    }
  }

  /**
   * Analyze document content using AI to determine type and extract structured data
   */
  async analyzeDocument(ocrResult: OCRResult): Promise<DocumentAnalysisResult> {
    try {
      this.logger.log('Analyzing document content with AI');

      const analysisPrompt = `
        Analyze this business document and extract the following information:
        
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
        10. Security features (seals, stamps, watermarks)
        11. Fraud indicators (sample, copy, fake, draft, template)
        
        Also determine if this is a valid business document and list any validation errors.
        
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
          "confidence": number,
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
        const validationResult = this.performComprehensiveValidation(
          analysis.extractedData || {},
          analysis.fraudIndicators || [],
          analysis.securityFeatures || [],
          ocrResult.confidence,
        );

        const result: DocumentAnalysisResult = {
          documentType: analysis.documentType || 'UNKNOWN',
          extractedData: analysis.extractedData || {},
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
          timeout: 30000,
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
    const errors: string[] = [];
    const warnings: string[] = [];
    let authenticityScore = 50; // Base score
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

    // Enhanced business name validation
    if (
      extractedData.businessName &&
      extractedData.businessName.trim().length > 0
    ) {
      const businessName = extractedData.businessName.trim();

      // Check for suspicious patterns in business name
      const suspiciousPatterns = [
        /test/i,
        /sample/i,
        /demo/i,
        /fake/i,
        /dummy/i,
        /example/i,
        /ltd\s*$/,
        /limited\s*$/i,
        /inc\s*$/,
        /corporation\s*$/i,
      ];

      const hasSuspiciousPattern = suspiciousPatterns.some((pattern) =>
        pattern.test(businessName),
      );

      if (hasSuspiciousPattern) {
        warnings.push('Business name contains potentially suspicious patterns');
        authenticityScore += 10; // Reduced score for suspicious patterns
      } else {
        authenticityScore += 15;
      }

      // Check name length and format
      if (businessName.length < 3) {
        warnings.push('Business name appears too short');
      } else if (businessName.length > 100) {
        warnings.push('Business name appears unusually long');
      }

      checklist.businessNameFound = true;
      checklist.properFormatting = true;
    } else {
      errors.push('Business name not found in document');
    }

    // Enhanced registration number validation (Kenya format)
    if (extractedData.registrationNumber) {
      const regNumber = extractedData.registrationNumber.trim().toUpperCase();

      // Multiple valid Kenya registration patterns
      const regPatterns = [
        /^(PVT-|C\.|P\.|LTD-)[A-Z0-9]{6,10}$/i, // Standard format
        /^C\.[0-9]{6,8}$/i, // Company format
        /^P\.[0-9]{6,8}$/i, // Partnership format
        /^LTD-[0-9]{6,8}$/i, // Limited format
        /^[A-Z]{2,3}[0-9]{6,8}$/i, // Alternative format
      ];

      const isValidFormat = regPatterns.some((pattern) =>
        pattern.test(regNumber),
      );

      if (isValidFormat) {
        checklist.validRegistrationFormat = true;
        authenticityScore += 10;

        // Additional validation for specific patterns
        if (regNumber.startsWith('C.')) {
          // Company registration - should have 6-8 digits
          const digits = regNumber.replace('C.', '');
          if (digits.length >= 6 && digits.length <= 8) {
            authenticityScore += 5;
          }
        }
      } else {
        errors.push('Invalid registration number format');
      }
    }

    // Enhanced tax number validation (Kenya PIN)
    if (extractedData.taxNumber) {
      const taxNumber = extractedData.taxNumber.trim().toUpperCase();

      // Kenya PIN format: 1 letter followed by 9 digits
      const taxPattern = /^[A-Z]\d{9}$/;

      if (taxPattern.test(taxNumber)) {
        checklist.validTaxFormat = true;
        authenticityScore += 10;

        // Additional PIN validation
        const letter = taxNumber.charAt(0);
        const digits = taxNumber.substring(1);

        // Check if letter is valid (A-Z)
        if (letter >= 'A' && letter <= 'Z') {
          authenticityScore += 5;
        }

        // Check for suspicious patterns in PIN
        if (
          digits === '000000000' ||
          digits === '111111111' ||
          digits === '123456789'
        ) {
          warnings.push('Tax number contains suspicious patterns');
          authenticityScore -= 10;
        }
      } else {
        errors.push(
          'Invalid tax number format (should be 1 letter + 9 digits)',
        );
      }
    }

    // Enhanced date validation
    if (extractedData.issueDate) {
      const issueDate = new Date(extractedData.issueDate);
      const now = new Date();
      const fiveYearsAgo = new Date(
        now.getFullYear() - 5,
        now.getMonth(),
        now.getDate(),
      );

      if (!isNaN(issueDate.getTime()) && issueDate <= now) {
        checklist.validIssueDate = true;
        authenticityScore += 5;

        // Check if document is recent (within 5 years)
        if (issueDate >= fiveYearsAgo) {
          checklist.recentDocument = true;
          authenticityScore += 10;
        } else {
          warnings.push('Document is older than 5 years');
        }

        // Check for suspicious future dates
        if (issueDate > now) {
          errors.push('Issue date cannot be in the future');
          authenticityScore -= 20;
        }
      } else {
        errors.push('Issue date is invalid or in the future');
      }
    }

    // Check expiry date
    if (extractedData.expiryDate) {
      const expiryDate = new Date(extractedData.expiryDate);
      const issueDate = extractedData.issueDate
        ? new Date(extractedData.issueDate)
        : null;

      if (!isNaN(expiryDate.getTime())) {
        if (issueDate && expiryDate > issueDate) {
          checklist.validExpiryDate = true;
          authenticityScore += 5;
        } else if (!issueDate) {
          checklist.validExpiryDate = true;
          authenticityScore += 5;
        } else {
          errors.push('Expiry date is before issue date');
        }
      } else {
        errors.push('Invalid expiry date format');
      }
    }

    // Enhanced issuing authority validation
    const officialAuthorities = [
      'kenya revenue authority',
      'kra',
      'registrar of companies',
      'roc',
      'county government',
      'county',
      'ministry of trade',
      'mot',
      'business registration service',
      'brs',
      'kenya investment authority',
      'kia',
      'national social security fund',
      'nssf',
      'national hospital insurance fund',
      'nhif',
    ];

    if (extractedData.issuingAuthority) {
      const authority = extractedData.issuingAuthority.toLowerCase();
      const isOfficial = officialAuthorities.some((auth) =>
        authority.includes(auth),
      );

      if (isOfficial) {
        checklist.officialAuthorityPresent = true;
        authenticityScore += 10;
      } else {
        warnings.push('Unknown or unofficial issuing authority');
        authenticityScore -= 5;
      }
    }

    // Business type validation
    if (extractedData.businessType) {
      const validBusinessTypes = [
        'limited company',
        'ltd',
        'limited',
        'partnership',
        'sole proprietorship',
        'cooperative',
        'ngo',
        'charity',
        'government',
        'public company',
        'private company',
        'corporation',
      ];

      const businessType = extractedData.businessType.toLowerCase();
      const isValidType = validBusinessTypes.some((type) =>
        businessType.includes(type),
      );

      if (isValidType) {
        checklist.validBusinessType = true;
        authenticityScore += 5;
      } else {
        warnings.push('Unrecognized business type');
      }
    }

    // Data consistency checks
    if (extractedData.businessName && extractedData.businessType) {
      const businessName = extractedData.businessName.toLowerCase();
      const businessType = extractedData.businessType.toLowerCase();

      // Check if business name matches business type
      if (
        businessType.includes('limited') &&
        !businessName.includes('ltd') &&
        !businessName.includes('limited')
      ) {
        warnings.push('Business name may not match business type');
      } else {
        checklist.consistentData = true;
        authenticityScore += 5;
      }
    }

    // Check security features
    if (securityFeatures.length > 0) {
      checklist.securityFeaturesDetected = true;
      authenticityScore += 10;
    }

    // Check fraud indicators
    if (fraudIndicators.length === 0) {
      checklist.noFraudIndicators = true;
      authenticityScore += 15;
    } else {
      errors.push(`Fraud indicators detected: ${fraudIndicators.join(', ')}`);
      authenticityScore -= fraudIndicators.length * 30;
    }

    // OCR confidence check
    if (ocrConfidence > 80) {
      authenticityScore += 20;
    } else if (ocrConfidence < 50) {
      authenticityScore -= 20;
      errors.push('Low image quality - please upload clearer scan');
    }

    // Ensure score is between 0 and 100
    authenticityScore = Math.max(0, Math.min(100, authenticityScore));

    return {
      isValid: errors.length === 0 && authenticityScore >= 60,
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

    const extractedData = {
      businessName: businessNameMatch?.[1]?.trim(),
      registrationNumber: registrationMatch?.[1]?.trim(),
      taxNumber: taxMatch?.[1]?.trim(),
      issueDate: dateMatch?.[0],
      expiryDate: dateMatch?.[1],
    };

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
      [],
      [],
      ocrConfidence,
    );

    return {
      documentType,
      extractedData,
      confidence: 60, // Lower confidence for fallback
      isValid: validationErrors.length === 0 && validationResult.isValid,
      validationErrors: [...validationErrors, ...validationResult.errors],
      warnings: validationResult.warnings,
      authenticityScore: validationResult.authenticityScore,
      fraudIndicators: [],
      securityFeatures: [],
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
}
