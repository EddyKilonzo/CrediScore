import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import axios from 'axios';
import Tesseract from 'tesseract.js';
import {
  CircuitBreakerService,
  CircuitState,
} from '../circuit-breaker/circuit-breaker.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  ReceiptData,
  BusinessDetails,
} from '../fraud-detection/fraud-detection.service';

export interface ReviewValidationResult {
  isValid: boolean;
  confidence: number;
  matchedFields: {
    businessName: boolean;
    amount: boolean;
    date: boolean;
    businessDetails: boolean;
  };
  extractedData: ReceiptData;
  validationNotes: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openaiApiKey: string;
  private readonly openaiBaseUrl: string;
  private readonly rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly maxRequestsPerMinute = 60;
  private readonly maxRequestsPerHour = 1000;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly metricsService: MetricsService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    this.openaiBaseUrl =
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1';
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(operation: string): boolean {
    const now = Date.now();
    const key = `${operation}:${Math.floor(now / 60000)}`; // Per minute
    const hourKey = `${operation}:${Math.floor(now / 3600000)}`; // Per hour

    // Check per-minute limit
    const minuteData = this.rateLimitMap.get(key) || {
      count: 0,
      resetTime: now + 60000,
    };
    if (minuteData.count >= this.maxRequestsPerMinute) {
      this.metricsService.recordRateLimitHit(operation, 'system');
      return false;
    }

    // Check per-hour limit
    const hourData = this.rateLimitMap.get(hourKey) || {
      count: 0,
      resetTime: now + 3600000,
    };
    if (hourData.count >= this.maxRequestsPerHour) {
      this.metricsService.recordRateLimitHit(operation, 'system');
      return false;
    }

    // Update counters
    minuteData.count++;
    hourData.count++;
    this.rateLimitMap.set(key, minuteData);
    this.rateLimitMap.set(hourKey, hourData);

    return true;
  }

  /**
   * Get cached result or execute operation
   */
  private async getCachedOrExecute<T>(
    cacheKey: string,
    operation: () => Promise<T>,
    ttl: number = 3600, // 1 hour default
  ): Promise<T> {
    try {
      const cached = await this.cacheManager.get<T>(cacheKey);
      if (cached) {
        this.metricsService.recordAiCacheHit('general');
        return cached;
      }
    } catch (error) {
      this.logger.warn('Cache get error:', error);
    }

    this.metricsService.recordAiCacheMiss('general');
    const result = await operation();

    try {
      await this.cacheManager.set(cacheKey, result, ttl);
    } catch (error) {
      this.logger.warn('Cache set error:', error);
    }

    return result;
  }

  /**
   * Extract text from receipt image using Tesseract.js OCR
   */
  async extractTextFromImage(imageUrl: string): Promise<string> {
    const startTime = Date.now();

    try {
      if (!this.checkRateLimit('ocr_tesseract')) {
        throw new BadRequestException('Rate limit exceeded for OCR operations');
      }

      this.logger.log(
        `Extracting text from image using Tesseract.js: ${imageUrl}`,
      );

      // Check cache first
      const cacheKey = `ocr_tesseract:${imageUrl}`;
      const result = await this.getCachedOrExecute(
        cacheKey,
        async () => {
          const result = await Tesseract.recognize(imageUrl, 'eng', {
            logger: (m: { status: string; progress: number }) => {
              if (m.status === 'recognizing text') {
                this.logger.debug(
                  `OCR Progress: ${Math.round(m.progress * 100)}%`,
                );
              }
            },
          });
          return result.data.text;
        },
        1800, // 30 minutes cache
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAiRequest(
        'tesseract',
        'ocr',
        'success',
        duration,
      );

      this.logger.log(
        `Text extracted successfully from image using Tesseract.js`,
      );
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAiRequest(
        'tesseract',
        'ocr',
        'error',
        duration,
      );

      this.logger.error(
        'Error extracting text from image with Tesseract.js:',
        error,
      );
      throw new InternalServerErrorException(
        'Failed to extract text from receipt image',
      );
    }
  }

  /**
   * Extract text from receipt image using Google Vision API (alternative)
   */
  async extractTextFromImageGoogleVision(imageUrl: string): Promise<string> {
    try {
      this.logger.log(
        `Extracting text from image using Google Vision: ${imageUrl}`,
      );

      // This would require @google-cloud/vision package
      // For now, we'll use a placeholder implementation
      // In production, you would implement the actual Google Vision API call

      const response = await axios.post(
        'https://vision.googleapis.com/v1/images:annotate',
        {
          requests: [
            {
              image: {
                source: {
                  imageUri: imageUrl,
                },
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.configService.get<string>('GOOGLE_VISION_API_KEY')}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data as {
        responses: Array<{
          textAnnotations?: Array<{ description?: string }>;
        }>;
      };
      const extractedText =
        data.responses[0]?.textAnnotations?.[0]?.description || '';
      this.logger.log(
        `Text extracted successfully from image using Google Vision`,
      );

      return extractedText;
    } catch (error) {
      this.logger.error(
        'Error extracting text from image with Google Vision:',
        error,
      );
      // Fallback to Tesseract.js
      return this.extractTextFromImage(imageUrl);
    }
  }

  /**
   * Real-time document scanning with comprehensive analysis
   */
  async scanDocumentRealTime(imageUrl: string): Promise<{
    documentType: string;
    extractedText: string;
    confidence: number;
    metadata: any;
    isReceipt: boolean;
    receiptData?: any;
    isBusinessDocument: boolean;
    businessDocumentData?: any;
  }> {
    try {
      this.logger.log(`Starting real-time document scan: ${imageUrl}`);

      // Extract text using Google Vision API
      const extractedText = await this.extractTextFromImageCloudinary(imageUrl);

      if (!extractedText || extractedText.trim().length === 0) {
        return {
          documentType: 'unknown',
          extractedText: '',
          confidence: 0,
          metadata: { error: 'No text detected' },
          isReceipt: false,
          isBusinessDocument: false,
        };
      }

      // Analyze document type
      const documentAnalysis = this.analyzeDocumentType(extractedText);

      let receiptData: ReceiptData | null = null;
      let businessDocumentData: unknown = null;

      // If it's a receipt, extract receipt-specific data
      if (documentAnalysis.isReceipt) {
        try {
          receiptData = await this.parseReceiptData(extractedText);
        } catch (error) {
          this.logger.warn('Failed to parse receipt data:', error);
        }
      }

      // If it's a business document, extract business-specific data
      if (documentAnalysis.isBusinessDocument) {
        try {
          businessDocumentData =
            await this.extractBusinessDocumentData(extractedText);
        } catch (error) {
          this.logger.warn('Failed to extract business document data:', error);
        }
      }

      const result = {
        documentType: documentAnalysis.type,
        extractedText,
        confidence: documentAnalysis.confidence,
        metadata: {
          textLength: extractedText.length,
          wordCount: extractedText.split(/\s+/).length,
          scanTimestamp: new Date().toISOString(),
        },
        isReceipt: documentAnalysis.isReceipt,
        receiptData,
        isBusinessDocument: documentAnalysis.isBusinessDocument,
        businessDocumentData,
      };

      this.logger.log(
        `Real-time scan completed: ${result.documentType} (confidence: ${result.confidence})`,
      );
      return result;
    } catch (error) {
      this.logger.error('Real-time document scanning failed:', error);
      throw error;
    }
  }

  /**
   * Analyze document type based on extracted text
   */
  private analyzeDocumentType(text: string): {
    type: string;
    confidence: number;
    isReceipt: boolean;
    isBusinessDocument: boolean;
  } {
    const lowerText = text.toLowerCase();

    // Receipt indicators
    const receiptIndicators = [
      'receipt',
      'invoice',
      'payment',
      'total',
      'amount',
      'date',
      'time',
      'cash',
      'card',
      'change',
      'subtotal',
      'tax',
      'tip',
      'thank you',
      'pos',
      'terminal',
      'transaction',
      'ref',
      'receipt no',
      'receipt #',
    ];

    // Business document indicators
    const businessIndicators = [
      'certificate',
      'license',
      'permit',
      'registration',
      'incorporation',
      'business',
      'company',
      'ltd',
      'inc',
      'corp',
      'llc',
      'partnership',
      'registration number',
      'license number',
      'permit number',
      'certificate number',
      'issued by',
      'authorized',
      'valid until',
      'expires',
      'renewal',
    ];

    // Count matches
    const receiptMatches = receiptIndicators.filter((indicator) =>
      lowerText.includes(indicator),
    ).length;

    const businessMatches = businessIndicators.filter((indicator) =>
      lowerText.includes(indicator),
    ).length;

    // Determine document type
    let type = 'unknown';
    let confidence = 0;
    let isReceipt = false;
    let isBusinessDocument = false;

    if (receiptMatches > businessMatches && receiptMatches >= 3) {
      type = 'receipt';
      confidence = Math.min(
        (receiptMatches / receiptIndicators.length) * 100,
        95,
      );
      isReceipt = true;
    } else if (businessMatches > receiptMatches && businessMatches >= 2) {
      type = 'business_document';
      confidence = Math.min(
        (businessMatches / businessIndicators.length) * 100,
        95,
      );
      isBusinessDocument = true;
    } else if (receiptMatches > 0 || businessMatches > 0) {
      type = 'mixed_document';
      confidence = Math.min(
        ((receiptMatches + businessMatches) /
          (receiptIndicators.length + businessIndicators.length)) *
          50,
        70,
      );
    }

    return { type, confidence, isReceipt, isBusinessDocument };
  }

  /**
   * Extract business document specific data
   */
  private async extractBusinessDocumentData(text: string): Promise<{
    documentType: string;
    businessName?: string;
    registrationNumber?: string;
    licenseNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    issuingAuthority?: string;
    businessAddress?: string;
  }> {
    try {
      // Use AI to extract structured business document data
      const prompt = `
        Extract business document information from the following text. Return a JSON object with the following fields:
        - documentType: Type of document (certificate, license, permit, etc.)
        - businessName: Name of the business
        - registrationNumber: Registration or license number
        - issueDate: Date the document was issued
        - expiryDate: Expiration date if applicable
        - issuingAuthority: Authority that issued the document
        - businessAddress: Business address if mentioned

        Text: ${text}

        Return only valid JSON, no additional text.
      `;

      const response = await axios.post(
        `${this.openaiBaseUrl}/chat/completions`,
        {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data as {
        choices: Array<{ message: { content?: string } }>;
      };
      const extractedData = JSON.parse(
        data.choices[0].message.content || '{}',
      ) as {
        documentType: string;
        businessName?: string;
        registrationNumber?: string;
        licenseNumber?: string;
        issueDate?: string;
        expiryDate?: string;
        issuingAuthority?: string;
        businessAddress?: string;
      };
      return extractedData;
    } catch (error) {
      this.logger.error('Failed to extract business document data:', error);
      return { documentType: 'unknown' };
    }
  }

  /**
   * Extract text from receipt image using Google Vision API (primary)
   * Cloudinary URLs are used for document storage
   */
  async extractTextFromImageCloudinary(imageUrl: string): Promise<string> {
    try {
      this.logger.log(
        `Extracting text from image using Google Vision API: ${imageUrl}`,
      );

      // Use Google Vision API for text extraction from Cloudinary URLs
      const apiKey = this.configService.get<string>('GOOGLE_VISION_API_KEY');
      if (!apiKey) {
        throw new Error('Google Vision API key not configured');
      }

      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          requests: [
            {
              image: {
                source: {
                  imageUri: imageUrl,
                },
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 1,
                },
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data as {
        responses: Array<{
          textAnnotations?: Array<{ description?: string }>;
        }>;
      };
      const annotations = data.responses[0]?.textAnnotations;
      const extractedText = annotations?.[0]?.description || '';

      this.logger.log(
        `Text extracted successfully from image using Google Vision API`,
      );
      return extractedText;
    } catch (error) {
      this.logger.error(
        'Error extracting text from image with Google Vision API:',
        error,
      );
      // Fallback to Tesseract.js
      return this.extractTextFromImage(imageUrl);
    }
  }

  /**
   * Parse receipt data from extracted text using AI
   */
  async parseReceiptData(extractedText: string): Promise<ReceiptData> {
    const startTime = Date.now();

    try {
      if (!this.checkRateLimit('parse_receipt')) {
        throw new BadRequestException(
          'Rate limit exceeded for receipt parsing',
        );
      }

      this.logger.log('Parsing receipt data from extracted text');

      // Check cache first
      const cacheKey = `parse_receipt:${Buffer.from(extractedText).toString('base64').slice(0, 100)}`;
      const result = await this.getCachedOrExecute(
        cacheKey,
        async () => {
          const prompt = `
            Analyze the following receipt text and extract structured data. Return a JSON object with the following fields:
            - businessName: The name of the business
            - businessAddress: The address of the business
            - businessPhone: The phone number of the business
            - amount: The total amount paid (as a number)
            - date: The date of the transaction (in YYYY-MM-DD format if possible)
            - items: Array of items purchased
            - receiptNumber: The receipt or transaction number
            - confidence: A number between 0 and 1 indicating confidence in the extraction

            Receipt text:
            ${extractedText}

            Return only valid JSON without any additional text or explanations.
          `;

          const response: { data: unknown } =
            await this.circuitBreakerService.execute(
              'openai_api',
              async () => {
                return await axios.post(
                  `${this.openaiBaseUrl}/chat/completions`,
                  {
                    model: 'gpt-4',
                    messages: [
                      {
                        role: 'user',
                        content: prompt,
                      },
                    ],
                    max_tokens: 500,
                    temperature: 0.1,
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${this.openaiApiKey}`,
                      'Content-Type': 'application/json',
                    },
                  },
                );
              },
              {
                failureThreshold: 3,
                timeout: 30000,
                resetTimeout: 60000,
              },
            );

          const data = response.data as {
            choices: Array<{ message: { content: string } }>;
          };
          const responseText = data.choices[0].message.content;

          try {
            const parsedData = JSON.parse(responseText) as ReceiptData;
            return parsedData;
          } catch (parseError) {
            this.logger.error('Error parsing AI response as JSON:', parseError);
            throw new InternalServerErrorException(
              'Failed to parse receipt data',
            );
          }
        },
        3600, // 1 hour cache
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAiRequest(
        'openai',
        'parse_receipt',
        'success',
        duration,
      );

      this.logger.log('Receipt data parsed successfully');
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAiRequest(
        'openai',
        'parse_receipt',
        'error',
        duration,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Error parsing receipt data:', error);
      throw new InternalServerErrorException('Failed to parse receipt data');
    }
  }

  /**
   * Validate receipt against business details and review information
   */
  validateReceiptAgainstReview(
    receiptData: ReceiptData,
    businessDetails: BusinessDetails,
    reviewAmount?: number,
    reviewDate?: string,
  ): ReviewValidationResult {
    try {
      this.logger.log('Validating receipt against business and review details');

      const validationNotes: string[] = [];
      const matchedFields = {
        businessName: false,
        amount: false,
        date: false,
        businessDetails: false,
      };

      // Validate business name
      if (receiptData.businessName && businessDetails.name) {
        const nameSimilarity = this.calculateStringSimilarity(
          receiptData.businessName.toLowerCase(),
          businessDetails.name.toLowerCase(),
        );
        matchedFields.businessName = nameSimilarity > 0.7;

        if (matchedFields.businessName) {
          validationNotes.push(
            `Business name matches (${Math.round(nameSimilarity * 100)}% similarity)`,
          );
        } else {
          validationNotes.push(
            `Business name does not match (${Math.round(nameSimilarity * 100)}% similarity)`,
          );
        }
      }

      // Validate amount
      if (receiptData.amount && reviewAmount) {
        const amountDifference = Math.abs(receiptData.amount - reviewAmount);
        const amountTolerance = Math.max(receiptData.amount * 0.1, 1); // 10% tolerance or $1
        matchedFields.amount = amountDifference <= amountTolerance;

        if (matchedFields.amount) {
          validationNotes.push(
            `Amount matches (${receiptData.amount} vs ${reviewAmount})`,
          );
        } else {
          validationNotes.push(
            `Amount does not match (${receiptData.amount} vs ${reviewAmount})`,
          );
        }
      }

      // Validate date
      if (receiptData.date && reviewDate) {
        const receiptDate = new Date(receiptData.date);
        const reviewDateObj = new Date(reviewDate);
        const dateDifference = Math.abs(
          receiptDate.getTime() - reviewDateObj.getTime(),
        );
        const daysDifference = dateDifference / (1000 * 60 * 60 * 24);
        matchedFields.date = daysDifference <= 7; // Allow 7 days difference

        if (matchedFields.date) {
          validationNotes.push(`Date matches (within 7 days)`);
        } else {
          validationNotes.push(
            `Date does not match (${Math.round(daysDifference)} days difference)`,
          );
        }
      }

      // Validate business details (address, phone)
      if (receiptData.businessAddress && businessDetails.address) {
        const addressSimilarity = this.calculateStringSimilarity(
          receiptData.businessAddress.toLowerCase(),
          businessDetails.address.toLowerCase(),
        );
        if (addressSimilarity > 0.6) {
          matchedFields.businessDetails = true;
          validationNotes.push(
            `Business address matches (${Math.round(addressSimilarity * 100)}% similarity)`,
          );
        }
      }

      if (receiptData.businessPhone && businessDetails.phone) {
        const phoneSimilarity = this.calculateStringSimilarity(
          receiptData.businessPhone.replace(/\D/g, ''),
          businessDetails.phone.replace(/\D/g, ''),
        );
        if (phoneSimilarity > 0.8) {
          matchedFields.businessDetails = true;
          validationNotes.push(`Business phone matches`);
        }
      }

      // Calculate overall confidence
      const fieldWeights = {
        businessName: 0.4,
        amount: 0.3,
        date: 0.2,
        businessDetails: 0.1,
      };

      let totalConfidence = 0;
      let totalWeight = 0;

      Object.entries(matchedFields).forEach(([field, matched]) => {
        if (matched) {
          totalConfidence += fieldWeights[field as keyof typeof fieldWeights];
        }
        totalWeight += fieldWeights[field as keyof typeof fieldWeights];
      });

      const overallConfidence =
        totalWeight > 0 ? totalConfidence / totalWeight : 0;
      const isValid = overallConfidence >= 0.6; // Minimum 60% confidence for validation

      if (isValid) {
        validationNotes.push(
          `Receipt validation PASSED (${Math.round(overallConfidence * 100)}% confidence)`,
        );
      } else {
        validationNotes.push(
          `Receipt validation FAILED (${Math.round(overallConfidence * 100)}% confidence)`,
        );
      }

      this.logger.log(
        `Receipt validation completed: ${isValid ? 'PASSED' : 'FAILED'} (${Math.round(overallConfidence * 100)}%)`,
      );

      return {
        isValid,
        confidence: overallConfidence,
        matchedFields,
        extractedData: receiptData,
        validationNotes,
      };
    } catch (error) {
      this.logger.error('Error validating receipt:', error);
      throw new InternalServerErrorException('Failed to validate receipt');
    }
  }

  /**
   * Complete receipt validation workflow
   */
  async validateReceiptForReview(
    imageUrl: string,
    businessDetails: BusinessDetails,
    reviewAmount?: number,
    reviewDate?: string,
  ): Promise<ReviewValidationResult> {
    try {
      this.logger.log('Starting complete receipt validation workflow');

      // Step 1: Extract text from image
      const extractedText = await this.extractTextFromImage(imageUrl);

      // Step 2: Parse receipt data
      const receiptData = await this.parseReceiptData(extractedText);

      // Step 3: Validate against business and review
      const validationResult = this.validateReceiptAgainstReview(
        receiptData,
        businessDetails,
        reviewAmount,
        reviewDate,
      );

      this.logger.log('Receipt validation workflow completed successfully');
      return validationResult;
    } catch (error) {
      this.logger.error('Error in receipt validation workflow:', error);
      throw error;
    }
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Call Python microservice for advanced fraud detection
   */
  async detectFraudWithPythonService(
    reviewText: string,
    receiptData: ReceiptData,
    businessDetails: BusinessDetails,
    userReputation: number,
  ): Promise<{
    isFraudulent: boolean;
    confidence: number;
    fraudReasons: string[];
    riskScore: number;
  }> {
    try {
      this.logger.log('Calling Python microservice for fraud detection');

      const pythonServiceUrl =
        this.configService.get<string>('PYTHON_FRAUD_SERVICE_URL') ||
        'http://localhost:8000';

      const response = await axios.post(
        `${pythonServiceUrl}/detect-fraud`,
        {
          review_text: reviewText,
          receipt_data: receiptData,
          business_details: businessDetails,
          user_reputation: userReputation,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        },
      );

      this.logger.log('Python fraud detection completed successfully');
      return response.data as {
        isFraudulent: boolean;
        confidence: number;
        fraudReasons: string[];
        riskScore: number;
      };
    } catch (error) {
      this.logger.error('Error calling Python fraud detection service:', error);

      // Fallback to basic fraud detection
      return this.basicFraudDetection(reviewText, receiptData, userReputation);
    }
  }

  /**
   * Basic fraud detection fallback
   */
  private basicFraudDetection(
    reviewText: string,
    receiptData: ReceiptData,
    userReputation: number,
  ): {
    isFraudulent: boolean;
    confidence: number;
    fraudReasons: string[];
    riskScore: number;
  } {
    const fraudReasons: string[] = [];
    let riskScore = 0;

    // Check for suspicious patterns
    if (reviewText.length < 10) {
      fraudReasons.push('Review too short');
      riskScore += 20;
    }

    if (reviewText.includes('fake') || reviewText.includes('scam')) {
      fraudReasons.push('Contains suspicious keywords');
      riskScore += 30;
    }

    if (userReputation < 30) {
      fraudReasons.push('Low user reputation');
      riskScore += 25;
    }

    if (!receiptData || receiptData.confidence < 0.5) {
      fraudReasons.push('Low receipt confidence');
      riskScore += 15;
    }

    const isFraudulent = riskScore > 50;
    const confidence = Math.min(riskScore / 100, 1);

    return {
      isFraudulent,
      confidence,
      fraudReasons,
      riskScore,
    };
  }

  /**
   * Generate AI-powered review credibility score
   */
  async generateReviewCredibilityScore(
    reviewText: string,
    rating: number,
    isVerified: boolean,
    userReputation: number,
  ): Promise<number> {
    const startTime = Date.now();

    try {
      if (!this.checkRateLimit('credibility_score')) {
        throw new BadRequestException(
          'Rate limit exceeded for credibility scoring',
        );
      }

      this.logger.log('Generating AI-powered review credibility score');

      // Check cache first
      const cacheKey = `credibility_score:${Buffer.from(reviewText).toString('base64').slice(0, 50)}:${rating}:${isVerified}:${userReputation}`;
      const result = await this.getCachedOrExecute(
        cacheKey,
        async () => {
          const prompt = `
            Analyze the following review and assign a credibility score from 0 to 100 based on:
            1. Review authenticity and detail
            2. Language quality and coherence
            3. Specificity of experience
            4. Overall helpfulness
            
            Review text: "${reviewText}"
            Rating: ${rating}/5
            Is verified with receipt: ${isVerified}
            User reputation: ${userReputation}/100
            
            Return only a number between 0 and 100 representing the credibility score.
          `;

          const response = await this.circuitBreakerService.execute(
            'openai_api',
            async () => {
              return await axios.post(
                `${this.openaiBaseUrl}/chat/completions`,
                {
                  model: 'gpt-4',
                  messages: [
                    {
                      role: 'user',
                      content: prompt,
                    },
                  ],
                  max_tokens: 10,
                  temperature: 0.1,
                },
                {
                  headers: {
                    Authorization: `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json',
                  },
                },
              );
            },
            {
              failureThreshold: 3,
              timeout: 30000,
              resetTimeout: 60000,
            },
          );

          const data = response.data as {
            choices: Array<{ message: { content: string } }>;
          };
          const scoreText = data.choices[0].message.content;
          const score = parseInt(scoreText.replace(/\D/g, ''), 10);

          if (isNaN(score) || score < 0 || score > 100) {
            // Fallback to basic calculation
            let baseScore = 50;
            if (isVerified) baseScore += 20;
            if (userReputation > 70) baseScore += 15;
            if (reviewText.length > 100) baseScore += 10;
            if (rating >= 4 || rating <= 2) baseScore += 5; // Extreme ratings are often more credible

            return Math.min(100, Math.max(0, baseScore));
          }

          return score;
        },
        1800, // 30 minutes cache
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAiRequest(
        'openai',
        'credibility_score',
        'success',
        duration,
      );

      this.logger.log(`AI credibility score generated: ${result}`);
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordAiRequest(
        'openai',
        'credibility_score',
        'error',
        duration,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Error generating credibility score:', error);

      // Fallback to basic calculation
      let baseScore = 50;
      if (isVerified) baseScore += 20;
      if (userReputation > 70) baseScore += 15;
      if (reviewText.length > 100) baseScore += 10;

      return Math.min(100, Math.max(0, baseScore));
    }
  }

  /**
   * Batch process multiple documents
   */
  async batchProcessDocuments(
    imageUrls: string[],
    options: {
      maxConcurrency?: number;
      operation?: 'ocr' | 'scan' | 'parse';
    } = {},
  ): Promise<
    Array<{
      url: string;
      result: any;
      error?: string;
      processingTime: number;
    }>
  > {
    const startTime = Date.now();
    const { maxConcurrency = 5, operation = 'scan' } = options;

    this.logger.log(
      `Starting batch processing of ${imageUrls.length} documents`,
    );
    this.metricsService.recordBatchProcessingSize(
      'documents',
      imageUrls.length,
    );

    const results: Array<{
      url: string;
      result: any;
      error?: string;
      processingTime: number;
    }> = [];

    // Process documents in batches to avoid overwhelming the system
    for (let i = 0; i < imageUrls.length; i += maxConcurrency) {
      const batch = imageUrls.slice(i, i + maxConcurrency);

      const batchPromises = batch.map(async (url) => {
        const itemStartTime = Date.now();

        try {
          let result: unknown;

          switch (operation) {
            case 'ocr':
              result = await this.extractTextFromImage(url);
              break;
            case 'scan':
              result = await this.scanDocumentRealTime(url);
              break;
            case 'parse': {
              const text = await this.extractTextFromImage(url);
              result = await this.parseReceiptData(text);
              break;
            }
            default:
              result = await this.scanDocumentRealTime(url);
          }

          const processingTime = Date.now() - itemStartTime;
          this.metricsService.recordDocumentProcessingDuration(
            operation,
            processingTime / 1000,
          );
          this.metricsService.recordDocumentProcessed(operation, 'success');

          return {
            url,
            result,
            processingTime,
          };
        } catch (error) {
          const processingTime = Date.now() - itemStartTime;
          this.metricsService.recordDocumentProcessingDuration(
            operation,
            processingTime / 1000,
          );
          this.metricsService.recordDocumentProcessed(operation, 'error');

          return {
            url,
            result: null,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent rate limiting
      if (i + maxConcurrency < imageUrls.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    this.logger.log(
      `Batch processing completed in ${totalDuration}s for ${imageUrls.length} documents`,
    );

    return results;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    metrics: {
      cacheHitRate: number;
      averageResponseTime: number;
      errorRate: number;
    };
  } {
    try {
      // Check circuit breaker states
      const circuitStates = this.circuitBreakerService.getAllCircuitStates();
      const openCircuits = Object.values(circuitStates).filter(
        (state) => state === CircuitState.OPEN,
      ).length;

      // Determine overall health
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (openCircuits > 0) {
        status = 'degraded';
      }
      if (openCircuits > 2) {
        status = 'unhealthy';
      }

      return {
        status,
        services: {
          openai: circuitStates['openai_api'] !== CircuitState.OPEN,
          tesseract: true, // Local service
          cache: true, // Local service
        },
        metrics: {
          cacheHitRate: 0.85, // Placeholder - would be calculated from actual metrics
          averageResponseTime: 2.5, // Placeholder
          errorRate: 0.05, // Placeholder
        },
      };
    } catch (error) {
      this.logger.error('Error getting health status:', error);
      return {
        status: 'unhealthy',
        services: {
          openai: false,
          tesseract: false,
          cache: false,
        },
        metrics: {
          cacheHitRate: 0,
          averageResponseTime: 0,
          errorRate: 1,
        },
      };
    }
  }
}
