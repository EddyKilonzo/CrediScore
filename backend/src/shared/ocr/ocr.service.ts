import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

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
}

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = process.env.OCR_API_KEY || '';
    this.apiUrl =
      process.env.OCR_API_URL || 'https://api.ocr.space/parse/image';
  }

  /**
   * Extract text from document image using OCR
   */
  async extractText(imageUrl: string): Promise<OCRResult> {
    try {
      this.logger.log(`Extracting text from image: ${imageUrl}`);

      const formData = new FormData();
      formData.append('url', imageUrl);
      formData.append('apikey', this.apiKey);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'true');
      formData.append('detectOrientation', 'true');

      const response = await axios.post(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000,
      });

      if (response.data.IsErroredOnProcessing) {
        throw new Error(`OCR processing failed: ${response.data.ErrorMessage}`);
      }

      const parsedResults = response.data.ParsedResults;
      if (!parsedResults || parsedResults.length === 0) {
        throw new Error('No text found in the document');
      }

      const result = parsedResults[0];
      const extractedText = result.ParsedText || '';
      const confidence =
        result.TextOverlay?.Lines?.reduce(
          (acc: number, line: any) => acc + (line.Words?.[0]?.Confidence || 0),
          0,
        ) / (result.TextOverlay?.Lines?.length || 1) || 0;

      // Extract bounding boxes for better analysis
      const boundingBoxes =
        result.TextOverlay?.Lines?.map((line: any) => ({
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
    } catch (error) {
      this.logger.error('Error extracting text from document:', error);
      throw new Error(`Failed to extract text from document: ${error.message}`);
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
          "validationErrors": ["string"]
        }
      `;

      // Use OpenAI API for document analysis
      const openaiResponse = await this.callOpenAI(analysisPrompt);

      try {
        const analysis = JSON.parse(openaiResponse);

        this.logger.log(
          `Document analysis completed - Type: ${analysis.documentType}, Valid: ${analysis.isValid}`,
        );

        return {
          documentType: analysis.documentType || 'UNKNOWN',
          extractedData: analysis.extractedData || {},
          confidence: analysis.confidence || 0,
          isValid: analysis.isValid || false,
          validationErrors: analysis.validationErrors || [],
        };
      } catch (parseError) {
        this.logger.warn(
          'Failed to parse AI analysis response, using fallback',
        );
        return this.fallbackDocumentAnalysis(ocrResult.text);
      }
    } catch (error) {
      this.logger.error('Error analyzing document:', error);
      return this.fallbackDocumentAnalysis(ocrResult.text);
    }
  }

  /**
   * Call OpenAI API for document analysis
   */
  private async callOpenAI(prompt: string): Promise<string> {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await axios.post(
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
   * Fallback document analysis using pattern matching
   */
  private fallbackDocumentAnalysis(text: string): DocumentAnalysisResult {
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
      /(?:registration number|reg no|reg\. no)[:\s]+([A-Z0-9\-\/]+)/i,
    );
    const taxMatch = text.match(
      /(?:tax number|tax no|tax\. no|pin)[:\s]+([A-Z0-9\-\/]+)/i,
    );
    const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g);

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

    return {
      documentType,
      extractedData,
      confidence: 60, // Lower confidence for fallback
      isValid: validationErrors.length === 0,
      validationErrors,
    };
  }

  /**
   * Verify document authenticity using AI
   */
  async verifyDocumentAuthenticity(
    ocrResult: OCRResult,
    analysisResult: DocumentAnalysisResult,
  ): Promise<{
    isAuthentic: boolean;
    confidence: number;
    reasons: string[];
  }> {
    try {
      this.logger.log('Verifying document authenticity');

      const verificationPrompt = `
        Verify the authenticity of this business document based on the following information:
        
        Extracted Text: ${ocrResult.text}
        Document Type: ${analysisResult.documentType}
        Extracted Data: ${JSON.stringify(analysisResult.extractedData)}
        OCR Confidence: ${ocrResult.confidence}%
        
        Check for:
        1. Document format consistency
        2. Presence of official seals/stamps
        3. Proper formatting and layout
        4. Logical data relationships
        5. Common fraud indicators
        
        Respond in JSON format:
        {
          "isAuthentic": boolean,
          "confidence": number,
          "reasons": ["string"]
        }
      `;

      const openaiResponse = await this.callOpenAI(verificationPrompt);

      try {
        const verification = JSON.parse(openaiResponse);

        this.logger.log(
          `Document authenticity verification completed - Authentic: ${verification.isAuthentic}`,
        );

        return {
          isAuthentic: verification.isAuthentic || false,
          confidence: verification.confidence || 0,
          reasons: verification.reasons || [],
        };
      } catch (parseError) {
        this.logger.warn(
          'Failed to parse authenticity verification response, using fallback',
        );
        return this.fallbackAuthenticityVerification(ocrResult, analysisResult);
      }
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
