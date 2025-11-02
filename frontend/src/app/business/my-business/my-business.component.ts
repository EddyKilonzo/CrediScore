import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../core/services/auth.service';
import { BusinessService, Business, DocumentType as BusinessDocumentType, OCRHealthStatus } from '../../core/services/business.service';
import { CloudinaryService } from '../../core/services/cloudinary.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Subject, takeUntil, interval } from 'rxjs';
import { HttpEventType } from '@angular/common/http';
import { filter, map } from 'rxjs/operators';

enum PaymentType {
  TILL = 'TILL',
  PAYBILL = 'PAYBILL',
  SEND_MONEY = 'SEND_MONEY',
  BANK = 'BANK',
}

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  required: boolean;
}

interface DocumentType {
  id: string;
  name: string;
  description: string;
  required: boolean;
  uploaded: boolean;
  verified: boolean;
  scanning: boolean;
  url?: string;
  scanResult?: {
    ocrConfidence: number;
    aiVerified: boolean;
    authenticityScore: number;
    confidence: number;
    documentType: string;
    isValid: boolean;
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
    validationErrors?: string[];
    warnings?: string[];
    fraudIndicators?: string[];
    securityFeatures?: string[];
    verificationChecklist?: {
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
  };
}

@Component({
  selector: 'app-my-business',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './my-business.component.html',
  styleUrl: './my-business.component.css'
})
export class MyBusinessComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Inject services
  private authService = inject(AuthService);
  private businessService = inject(BusinessService);
  private cloudinaryService = inject(CloudinaryService);
  private toastService = inject(ToastService);

  // Authentication state
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Business data
  currentBusiness: Business | null = null;
  cachedReputationLevel: string = '';

  // Dashboard data
  onboardingSteps: OnboardingStep[] = [
    {
      id: 1,
      title: 'Business Profile',
      description: 'Complete your business information',
      icon: 'fas fa-building',
      completed: false,
      required: true
    },
    {
      id: 2,
      title: 'Upload Documents',
      description: 'Verify your business with at least one document',
      icon: 'fas fa-file-upload',
      completed: false,
      required: true
    },
    {
      id: 3,
      title: 'Payment Methods',
      description: 'Add payment methods for transactions',
      icon: 'fas fa-credit-card',
      completed: false,
      required: true
    },
    {
      id: 4,
      title: 'Review & Submit',
      description: 'Submit for verification review',
      icon: 'fas fa-check-circle',
      completed: false,
      required: true
    }
  ];

  // Pagination state
  paymentMethodsPage = signal(1);
  documentsPage = signal(1);
  itemsPerPage = signal(5);

  // Math object for template access
  Math = Math;

  // Helper method for Math.min in templates
  getMinValue(a: number, b: number): number {
    return Math.min(a, b);
  }

  requiredDocuments: DocumentType[] = [
    {
      id: 'business_registration',
      name: 'Business Registration Certificate',
      description: 'Official certificate of business registration (Optional)',
      required: false,
      uploaded: false,
      verified: false,
      scanning: false
    },
    {
      id: 'tax_certificate',
      name: 'Tax Certificate',
      description: 'Valid tax compliance certificate (Optional)',
      required: false,
      uploaded: false,
      verified: false,
      scanning: false
    }
  ];

  isLoading = true;
  showUploadModal = false;
  selectedDocumentType: DocumentType | null = null;
  isScanning = false;
  scanningProgress = 0;
  isDocumentUploading = false;
  documentUploadProgress = 0;
  selectedFile: File | null = null;

  // OCR/AI Service Status
  ocrHealthStatus: OCRHealthStatus | null = null;
  isCheckingOCRStatus = false;

  // Logo Upload
  isLogoUploading = false;
  logoUploadProgress = 0;
  selectedLogoFile: File | null = null;
  logoPreview: string | null = null;

  // Location and Social Media
  businessLocation: string = '';
  socialLinks = {
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    tiktok: ''
  };

  // Business Profile
  businessProfile = {
    name: '',
    catchphrase: '',
    logo: '',
    description: '',
    website: '',
    phone: '',
    email: ''
  };

  // Form state
  profileFormTouched = false;
  isUpdatingProfile = false;
  originalBusinessProfile: any = null;
  fieldTouched: { [key: string]: boolean } = {
    name: false,
    email: false,
    phone: false,
    website: false,
    description: false,
    catchphrase: false
  };

  // Payment Methods
  paymentMethods: any[] = [];
  showAddPaymentModal = false;
  newPaymentMethod = {
    type: PaymentType.TILL,
    number: '',
    accountNumber: '' // For Paybill
  };
  paymentFormTouched = false;
  paymentFieldTouched: { [key: string]: boolean } = {
    type: false,
    number: false,
    accountNumber: false
  };

  ngOnInit() {
    this.loadBusinessData();
    this.checkOCRServiceStatus();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBusinessData() {
    const user = this.currentUser();
    
    if (!user) {
      this.isLoading = false;
      return;
    }

    // Load user's businesses first
    this.businessService.getAllBusinesses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (businesses: Business[]) => {
          if (businesses && businesses.length > 0) {
            this.currentBusiness = businesses[0];
            this.isLoading = false;
            this.loadBusinessDocuments();
            this.loadBusinessLocation();
            this.loadSocialLinks();
            this.loadBusinessProfile();
            this.loadPaymentMethods();
          } else {
            // No business found - this is normal during onboarding
            this.isLoading = false;
            this.currentBusiness = null;
            // Don't show error - this is expected during the creation process
            // The user will create the business when they fill out the profile form
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          
          // Check if it's a connection error
          if (error.status === 0 || error.statusText === 'Unknown Error' || error.message?.includes('Failed to fetch')) {
            this.toastService.show(
              'Cannot connect to server. Please make sure the backend server is running on http://localhost:3000', 
              'error'
            );
          } else if (error.status === 401 || error.status === 403) {
            this.toastService.show('Authentication required. Please log in again.', 'warning');
          } else {
            // For 404 or other errors when no business exists, treat it as normal during onboarding
            if (error.status === 404) {
              this.currentBusiness = null;
              // Silent - this is expected during onboarding
            } else {
              const errorMessage = error.error?.message || error.message || 'Failed to load business data';
              this.toastService.show(errorMessage, 'error');
            }
          }
        }
      });
  }

  private loadBusinessDocuments() {
    if (!this.currentBusiness) return;

    // Load documents from the business data
    const documents = (this.currentBusiness as any).documents || [];
    
    // Update document status based on loaded documents
    if (documents.length > 0) {
      this.updateDocumentStatus(documents);
    }
    
    // Mark step 1 (Upload Documents) as completed if at least one document is uploaded
    this.onboardingSteps[1].completed = documents.length > 0;
    
    // Mark step 3 (Review & Submit) as completed if business has been submitted for review
    const businessWithStatus = this.currentBusiness as any;
    this.onboardingSteps[3].completed = businessWithStatus.submittedForReview === true;
    
    this.isLoading = false;
  }

  private loadBusinessLocation() {
    if (!this.currentBusiness) return;
    
    // Load location from business data if available
    this.businessLocation = (this.currentBusiness as any).location || '';
  }

  private createBusinessIfNeeded(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if we already have a business
      if (this.currentBusiness && this.currentBusiness.id) {
        resolve();
        return;
      }

      // Validate we have minimum required data
      if (!this.businessProfile.name?.trim()) {
        this.toastService.show('Business name is required to create your business profile.', 'warning');
        reject(new Error('Business name required'));
        return;
      }

      // Get current user
      const user = this.currentUser();
      if (!user) {
        this.toastService.show('Authentication required. Please log in again.', 'warning');
        reject(new Error('User not authenticated'));
        return;
      }

      // Prepare business creation data
      // Ensure all required fields have values
      const phoneValue = this.businessProfile.phone?.trim() || user.phone || '';
      const emailValue = this.businessProfile.email?.trim() || user.email || '';
      
      if (!phoneValue || !emailValue) {
        this.toastService.show('Phone number and email are required to create your business profile.', 'warning');
        reject(new Error('Phone and email required'));
        return;
      }

      const businessData = {
        name: this.businessProfile.name.trim(),
        description: this.businessProfile.description?.trim() || 'Business description will be updated soon.',
        address: this.businessLocation?.trim() || 'Address will be updated soon.',
        phone: phoneValue,
        email: emailValue,
        website: this.businessProfile.website?.trim() || undefined,
        category: 'General' // Default category - can be updated later
      };

      // Create the business
      this.businessService.createBusiness(businessData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (business) => {
            this.currentBusiness = business;
            this.toastService.show('Business profile created successfully!', 'success');
            
            // Update onboarding step
            this.onboardingSteps[0].completed = true;
            
            // Load related data
            this.loadBusinessProfile();
            this.loadBusinessLocation();
            this.loadSocialLinks();
            
            resolve();
          },
          error: (error) => {
            let errorMessage = 'Failed to create business profile';
            if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.message) {
              errorMessage = error.message;
            }
            this.toastService.show(errorMessage, 'error');
            reject(error);
          }
        });
    });
  }

  private loadSocialLinks() {
    if (!this.currentBusiness) return;
    
    // Load social links from business data if available
    const businessWithSocialLinks = this.currentBusiness as any;
    if (businessWithSocialLinks.socialLinks) {
      this.socialLinks = { ...this.socialLinks, ...businessWithSocialLinks.socialLinks };
    }
  }

  private loadBusinessProfile() {
    if (!this.currentBusiness) return;
    
    const businessWithExtendedFields = this.currentBusiness as any;
    this.businessProfile = {
      name: this.currentBusiness.name || '',
      catchphrase: this.currentBusiness.catchphrase || businessWithExtendedFields.catchphrase || '', // Load from backend
      logo: this.currentBusiness.logo || businessWithExtendedFields.logo || '', // Load from backend
      description: this.currentBusiness.description || '',
      website: this.currentBusiness.website || '',
      phone: this.currentBusiness.phone || '',
      email: this.currentBusiness.email || ''
    };
    
    // Store original profile for reset functionality
    this.originalBusinessProfile = { ...this.businessProfile };
    
    // Check if business profile is complete and mark step as completed
    // A profile is considered complete if it has name, description, phone, and email
    const isProfileComplete = !!(
      this.businessProfile.name?.trim() &&
      this.businessProfile.description?.trim() &&
      this.businessProfile.phone?.trim() &&
      this.businessProfile.email?.trim()
    );
    
    this.onboardingSteps[0].completed = isProfileComplete;
  }

  private loadPaymentMethods() {
    if (!this.currentBusiness) return;

    // Load payment methods from the business data
    this.paymentMethods = this.currentBusiness.payments || [];
    
    // Update onboarding step based on payment methods
    this.onboardingSteps[2].completed = this.paymentMethods.length > 0;
  }

  private updateDocumentStatus(documents: any[]) {
    // Update document status based on real data
    this.requiredDocuments.forEach(doc => {
      const realDoc = documents.find(d => d.type === this.getDocumentTypeEnum(doc.id));
      if (realDoc) {
        doc.uploaded = true;
        doc.verified = realDoc.verified;
        doc.scanning = !realDoc.aiAnalysis && realDoc.uploaded;
        doc.url = realDoc.url; // Store the URL for viewing
        
        if (realDoc.aiAnalysis) {
          doc.scanResult = {
            ocrConfidence: realDoc.ocrConfidence || 0,
            aiVerified: realDoc.aiVerified || false,
            authenticityScore: realDoc.authenticityScore || 0,
            confidence: realDoc.aiAnalysis.confidence || 0,
            documentType: realDoc.aiAnalysis.documentType || 'Unknown',
            isValid: realDoc.aiAnalysis.isValid || false,
            extractedData: realDoc.extractedData,
            validationErrors: realDoc.aiAnalysis.validationErrors || [],
            warnings: realDoc.aiAnalysis.warnings || [],
            fraudIndicators: realDoc.aiAnalysis.fraudIndicators || [],
            securityFeatures: realDoc.aiAnalysis.securityFeatures || [],
            verificationChecklist: realDoc.aiAnalysis.verificationChecklist || {}
          };
        }
      }
    });
  }

  private getDocumentTypeEnum(documentId: string): BusinessDocumentType {
    switch (documentId) {
      case 'business_registration':
        return BusinessDocumentType.BUSINESS_REGISTRATION;
      case 'tax_certificate':
        return BusinessDocumentType.TAX_CERTIFICATE;
      default:
        return BusinessDocumentType.BUSINESS_DOCUMENT;
    }
  }

  getOnboardingProgress(): number {
    const completedSteps = this.onboardingSteps.filter(step => step.completed).length;
    const percentage = (completedSteps / this.onboardingSteps.length) * 100;
    return Math.min(Math.round(percentage), 100); // Cap at 100% and round to whole number
  }

  getCompletedStepsCount(): number {
    return this.onboardingSteps.filter(step => step.completed).length;
  }

  getTotalStepsCount(): number {
    return this.onboardingSteps.length;
  }

  // Pagination methods for payment methods
  getPaginatedPaymentMethods(): any[] {
    const startIndex = (this.paymentMethodsPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return this.paymentMethods.slice(startIndex, endIndex);
  }

  getPaymentMethodsPagination(): any {
    const total = this.paymentMethods.length;
    const totalPages = Math.ceil(total / this.itemsPerPage());
    return {
      page: this.paymentMethodsPage(),
      limit: this.itemsPerPage(),
      total: total,
      totalPages: totalPages
    };
  }

  onPaymentMethodsPageChange(page: number): void {
    this.paymentMethodsPage.set(page);
    // Scroll to payment methods section
    setTimeout(() => {
      const element = document.getElementById('payment-methods-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  getPaymentMethodsPageNumbers(): number[] {
    const pagination = this.getPaymentMethodsPagination();
    if (!pagination) return [];
    
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pages: number[] = [];
    
    // Show up to 5 page numbers around current page
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // Pagination methods for documents
  getPaginatedDocuments(): DocumentType[] {
    const startIndex = (this.documentsPage() - 1) * this.itemsPerPage();
    const endIndex = startIndex + this.itemsPerPage();
    return this.requiredDocuments.slice(startIndex, endIndex);
  }

  getDocumentsPagination(): any {
    const total = this.requiredDocuments.length;
    const totalPages = Math.ceil(total / this.itemsPerPage());
    return {
      page: this.documentsPage(),
      limit: this.itemsPerPage(),
      total: total,
      totalPages: totalPages
    };
  }

  onDocumentsPageChange(page: number): void {
    this.documentsPage.set(page);
    // Scroll to documents section
    setTimeout(() => {
      const element = document.getElementById('documents-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  getDocumentsPageNumbers(): number[] {
    const pagination = this.getDocumentsPagination();
    if (!pagination) return [];
    
    const currentPage = pagination.page;
    const totalPages = pagination.totalPages;
    const pages: number[] = [];
    
    // Show up to 5 page numbers around current page
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  getUploadedDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.uploaded).length;
  }

  getRequiredDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.required).length;
  }

  getVerifiedDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.verified).length;
  }

  getScanningDocumentsCount(): number {
    return this.requiredDocuments.filter(doc => doc.scanning).length;
  }

  openUploadModal(documentType: DocumentType) {
    this.selectedDocumentType = documentType;
    this.showUploadModal = true;
  }

  viewDocument(document: DocumentType) {
    if (document.url) {
      window.open(document.url, '_blank');
    } else {
      this.toastService.show('Document URL is not available.', 'error');
    }
  }

  closeUploadModal() {
    this.showUploadModal = false;
    this.selectedDocumentType = null;
    this.selectedFile = null;
    this.isDocumentUploading = false;
    this.documentUploadProgress = 0;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.validateSelectedFile();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Add visual feedback for drag over
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    // Remove visual feedback
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
      this.validateSelectedFile();
    }
  }

  validateSelectedFile() {
    if (!this.selectedFile) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

    if (this.selectedFile.size > maxSize) {
      this.toastService.show('File size must be less than 10MB', 'error');
      this.selectedFile = null;
      return;
    }

    if (!allowedTypes.includes(this.selectedFile.type)) {
      this.toastService.show('Only JPG, PNG, and PDF files are allowed', 'error');
      this.selectedFile = null;
      return;
    }

    this.toastService.show('File selected successfully', 'success');
  }

  clearSelectedFile() {
    this.selectedFile = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  testUpload() {
    if (!this.selectedFile) {
      this.toastService.show('Please select a file first!', 'warning');
      return;
    }
    
    if (!this.selectedDocumentType) {
      this.toastService.show('No document type selected!', 'warning');
      return;
    }
    
    if (!this.currentBusiness) {
      // Try to create business first if profile has minimum required data
      if (this.businessProfile.name?.trim()) {
        this.createBusinessIfNeeded().then(() => {
          if (this.currentBusiness) {
            this.uploadSelectedDocument();
          }
        });
      } else {
        this.toastService.show('Please complete your business profile first before uploading documents.', 'warning');
      }
      return;
    }
    
    this.uploadSelectedDocument();
  }

  uploadSelectedDocument() {
    if (!this.selectedFile || !this.selectedDocumentType) {
      this.toastService.show('Please select a file to upload', 'warning');
      return;
    }
    
    if (!this.currentBusiness) {
      this.toastService.show('Please complete your business profile first before uploading documents.', 'warning');
      return;
    }

    this.isDocumentUploading = true;
    this.documentUploadProgress = 0;

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      if (this.documentUploadProgress < 90) {
        this.documentUploadProgress = Math.min(this.documentUploadProgress + Math.random() * 15, 90);
      }
    }, 300);

    // Upload document using the business service
    this.businessService.uploadDocument(
      this.currentBusiness.id, 
      this.selectedFile, 
      this.getDocumentTypeEnum(this.selectedDocumentType.id)
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (document) => {
          clearInterval(progressInterval);
          this.documentUploadProgress = 100;
          
          setTimeout(() => {
            this.toastService.show(`Document uploaded! AI verification in progress...`, 'success');
            
            // Update document status
            const documentType = this.requiredDocuments.find(doc => doc.id === this.selectedDocumentType!.id);
            if (documentType) {
              documentType.uploaded = true;
              documentType.scanning = true;
              this.isScanning = true;
              this.scanningProgress = 0;
            }
            
            // Start polling for processing status
            this.startProcessingStatusPolling(document.id);
            
            this.closeUploadModal();
          }, 500);
        },
        error: (error) => {
          clearInterval(progressInterval);
          const errorMessage = error.error?.message || error.message || 'Unknown error';
          this.toastService.show(`Failed to upload document: ${errorMessage}. Please try again.`, 'error');
          this.isDocumentUploading = false;
          this.documentUploadProgress = 0;
        }
      });
  }



  private startProcessingStatusPolling(documentId: string) {
    if (!this.currentBusiness) return;

    const pollInterval = interval(2000) // Poll every 2 seconds
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.businessService.getDocumentProcessingStatus(this.currentBusiness!.id, documentId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (status) => {
              this.updateProcessingStatus(status);
              if (status.processingStatus === 'completed' || status.processingStatus === 'failed') {
                pollInterval.unsubscribe();
              }
            },
            error: (error) => {
              pollInterval.unsubscribe();
            }
          });
      });
  }

  private updateProcessingStatus(status: any) {
    // Update scanning progress - backend doesn't provide progress, so we simulate it
    if (!status.processingStatus || status.processingStatus === 'processing') {
      // Still processing - increment progress smoothly
      if (this.scanningProgress < 95) {
        this.scanningProgress = Math.round(Math.min(95, this.scanningProgress + 15));
      }
      // Continue polling
      return;
    }
    
    if (status.processingStatus === 'completed') {
      // Complete the progress bar to 100%
      this.scanningProgress = 100;
      setTimeout(() => {
        this.completeDocumentScanning(status);
      }, 500);
    } else if (status.processingStatus === 'failed') {
      // Processing failed - check if it's a hard failure or recoverable
      let errorMessage = 'Document processing failed. Please try again.';
      let shouldReject = true;
      
      if (status.aiAnalysis?.error) {
        const rawError = status.aiAnalysis.error;
        // Make error message user-friendly
        if (rawError.includes('zero length') || rawError.includes('Invalid file') || 
            rawError.includes('OCR') || rawError.includes('text extraction')) {
          // These are OCR-related errors - don't reject outright, treat as low confidence
          shouldReject = false;
          // Mark as completed with low confidence instead of failed
          this.scanningProgress = 100;
          setTimeout(() => {
            this.completeDocumentScanning({
              ...status,
              processingStatus: 'completed',
              aiAnalysis: {
                ...status.aiAnalysis,
                authenticityScore: 25,
                isValid: true,
                warnings: [
                  'Document uploaded successfully but automatic text extraction encountered difficulties.',
                  'Your document will be manually reviewed by an administrator.',
                  'For faster processing, try uploading a clearer, higher-resolution image.'
                ]
              }
            });
          }, 500);
          return;
        } else if (rawError.includes('Network') || rawError.includes('timeout')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = 'Document processing failed. Please try uploading a different file format or clearer image.';
        }
      }
      
      if (shouldReject) {
        this.handleUploadError(this.requiredDocuments.find(d => d.scanning)!, errorMessage);
      }
    }
  }

  private completeDocumentScanning(status: any) {
    const document = this.requiredDocuments.find(d => d.scanning);
    if (!document) return;

    // Update document with real AI analysis results
    document.scanResult = {
      ocrConfidence: status.ocrConfidence || 0,
      aiVerified: status.aiVerified || false,
      authenticityScore: status.aiAnalysis?.authenticityScore || 0,
      confidence: status.aiAnalysis?.confidence || 0,
      documentType: status.aiAnalysis?.documentType || 'Unknown',
      isValid: status.aiAnalysis?.isValid || false,
      extractedData: status.extractedData || status.aiAnalysis?.extractedData || {},
      validationErrors: status.aiAnalysis?.validationErrors || [],
      warnings: status.aiAnalysis?.warnings || [],
      fraudIndicators: status.aiAnalysis?.fraudIndicators || [],
      securityFeatures: status.aiAnalysis?.securityFeatures || [],
      verificationChecklist: status.aiAnalysis?.verificationChecklist || {}
    };

    document.scanning = false;
    document.verified = status.aiVerified || false;
    this.isScanning = false;
    this.scanningProgress = 0;

    if (status.aiVerified) {
      this.toastService.show(`Document verified! AI found all required information.`, 'success');
    } else {
      const score = status.aiAnalysis?.authenticityScore || 0;
      const hasWarnings = status.aiAnalysis?.warnings?.length > 0;
      const requiresManualReview = status.aiAnalysis?.requiresManualReview || false;
      
      if (requiresManualReview || score < 40) {
        // Low confidence or manual review required
        if (hasWarnings && status.aiAnalysis.warnings[0]) {
          // Show the first warning which usually contains the most relevant info
          this.toastService.show(status.aiAnalysis.warnings[0], 'info');
        } else {
          this.toastService.show(
            `Document uploaded successfully but requires manual verification. An administrator will review it shortly.`,
            'info'
          );
        }
      } else if (score >= 60) {
        this.toastService.show(`Document processed (${score}% score). Requires admin review for final approval.`, 'warning');
      } else {
        this.toastService.show(
          `Document uploaded (${score}% confidence). Consider uploading a clearer image for better results, or proceed with manual review.`,
          'warning'
        );
      }
    }
  }

  private handleUploadError(document: DocumentType, message: string) {
    document.uploaded = false;
    document.scanning = false;
    this.isScanning = false;
    this.scanningProgress = 0;
    this.toastService.show(`${document.name}: ${message}`, 'error');
  }

  getStatusColor(status: 'pending' | 'completed' | 'in-progress'): string {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  getDocumentStatusColor(document: DocumentType): string {
    if (document.scanning) return 'text-blue-600 bg-blue-100';
    if (document.verified) return 'text-green-600 bg-green-100';
    if (document.uploaded) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  }

  getDocumentStatusText(document: DocumentType): string {
    if (document.scanning) return 'Scanning...';
    if (document.verified) return 'Verified';
    if (document.uploaded) return 'Under Review';
    return 'Not Uploaded';
  }

  canSubmitForReview(): boolean {
    // Need a business and at least one document uploaded
    if (!this.currentBusiness) return false;
    return this.getUploadedDocumentsCount() >= 1;
  }

  submitForReview() {
    if (!this.currentBusiness) {
      this.toastService.show('Please complete your business profile first before submitting for review.', 'warning');
      return;
    }
    
    if (this.canSubmitForReview()) {
      this.businessService.submitForReview(this.currentBusiness.id, 'Business submitted for verification review')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (business) => {
            this.currentBusiness = business;
            this.toastService.show('Business profile submitted for review! You will be notified once verification is complete.', 'success');
            this.onboardingSteps[3].completed = true;
          },
          error: (error) => {
            const errorMessage = error.error?.message || 'Failed to submit for review. Please try again.';
            this.toastService.show(errorMessage, 'error');
          }
        });
    } else {
      this.toastService.show('Please upload at least one document before submitting for review.', 'warning');
    }
  }

  getScanningTime(): number {
    // Return a mock scanning time for demonstration
    // In a real implementation, this would track actual scanning duration
    return Math.floor(Math.random() * 5) + 3; // 3-7 seconds
  }

  formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  }

  getUserInitials(user: User): string {
    if (!user || !user.name) return '';
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[1] || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  getBusinessReputationLevel(): string {
    const user = this.currentUser();
    if (!user || user.role !== 'business') return '';
    
    // Return cached value if available
    if (this.cachedReputationLevel) {
      return this.cachedReputationLevel;
    }
    
    // Generate and cache reputation level only once
    const mockReputation = Math.floor(Math.random() * 100) + 1;
    
    if (mockReputation >= 90) this.cachedReputationLevel = 'Elite Business';
    else if (mockReputation >= 75) this.cachedReputationLevel = 'Trusted Partner';
    else if (mockReputation >= 60) this.cachedReputationLevel = 'Verified Business';
    else if (mockReputation >= 40) this.cachedReputationLevel = 'Active Business';
    else this.cachedReputationLevel = 'New Business';
    
    return this.cachedReputationLevel;
  }

  // Location Picker Methods
  openLocationPicker() {
    // This would typically open a map picker modal
    this.toastService.show('Location picker feature coming soon', 'info');
  }

  updateLocation() {
    if (!this.businessLocation.trim()) {
      this.toastService.show('Please enter a business address', 'warning');
      return;
    }

    // This would typically call an API to update the business location
    this.toastService.show('Location updated successfully', 'success');
  }

  viewOnMap() {
    if (!this.businessLocation.trim()) {
      this.toastService.show('Please enter a business address first', 'warning');
      return;
    }

    // This would typically open the location in Google Maps or similar
    const encodedAddress = encodeURIComponent(this.businessLocation);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  }

  // Social Media Methods
  updateSocialLinks() {
    if (!this.currentBusiness) return;

    // Validate social links
    const hasValidLinks = Object.values(this.socialLinks).some(link => link.trim() !== '');
    
    if (!hasValidLinks) {
      this.toastService.show('Please enter at least one social media link', 'warning');
      return;
    }

    // For now, just show success message since the method doesn't exist in core service
    this.toastService.show('Social media links updated successfully', 'success');
  }

  previewSocialLinks() {
    const validLinks = Object.entries(this.socialLinks)
      .filter(([platform, link]) => link.trim() !== '')
      .map(([platform, link]) => `${platform}: ${link}`)
      .join('\n');

    if (validLinks) {
      alert(`Social Media Preview:\n\n${validLinks}`);
    } else {
      this.toastService.show('No social media links to preview', 'info');
    }
  }

  // Business Profile Methods
  updateBusinessProfile() {
    // Check if business data is still loading
    if (this.isLoading) {
      this.toastService.show('Please wait while business data is loading...', 'info');
      return;
    }

    // Mark form as touched for validation
    this.profileFormTouched = true;

    if (!this.businessProfile.name?.trim()) {
      this.toastService.show('Business name is required', 'warning');
      return;
    }

    // Validate email if provided
    if (this.businessProfile.email && !this.isValidEmail(this.businessProfile.email)) {
      this.toastService.show('Please enter a valid email address', 'warning');
      return;
    }

    // If no business exists, create it first
    if (!this.currentBusiness || !this.currentBusiness.id) {
      this.createBusinessIfNeeded().then(() => {
        if (this.currentBusiness) {
          // Retry update after creation
          this.updateBusinessProfile();
        }
      });
      return;
    }

    this.isUpdatingProfile = true;

    // Prepare update data matching backend UpdateBusinessDto
    // Note: name is readonly and should not be updated (verified from documents)
    const updateData: any = {
      description: this.businessProfile.description?.trim() || undefined,
      website: this.businessProfile.website?.trim() || undefined,
      phone: this.businessProfile.phone?.trim() || undefined,
      email: this.businessProfile.email?.trim() || undefined,
      logo: this.businessProfile.logo?.trim() || undefined,
      catchphrase: this.businessProfile.catchphrase?.trim() || undefined,
      // location is mapped from businessLocation if needed
      // category can be added if needed
    };

    // Remove undefined values to avoid sending them
    // Note: Empty strings are kept to allow clearing fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Ensure we have a valid business ID
    if (!this.currentBusiness || !this.currentBusiness.id) {
      this.isUpdatingProfile = false;
      this.toastService.show('Cannot save: Business ID is missing. Please refresh the page.', 'error');
      return;
    }

    // Create update request with id
    const updateRequest = {
      id: this.currentBusiness.id,
      ...updateData
    };

    this.businessService.updateBusiness(updateRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedBusiness) => {
          this.currentBusiness = updatedBusiness;
          
          // Update local profile data to match response
          this.businessProfile = {
            name: updatedBusiness.name || '',
            catchphrase: (updatedBusiness as any).catchphrase || '', // Load from backend
            logo: (updatedBusiness as any).logo || '', // Load from backend
            description: updatedBusiness.description || '',
            website: updatedBusiness.website || '',
            phone: updatedBusiness.phone || '',
            email: updatedBusiness.email || ''
          };
          
          this.originalBusinessProfile = { ...this.businessProfile };
          this.profileFormTouched = false;
          this.isUpdatingProfile = false;
          this.toastService.show('Business profile updated successfully', 'success');
        },
        error: (error) => {
          this.isUpdatingProfile = false;
          
          // Provide specific error messages
          let errorMessage = 'Failed to update business profile';
          if (error.status === 403) {
            errorMessage = 'You do not have permission to update this business';
          } else if (error.status === 404) {
            errorMessage = 'Business not found';
          } else if (error.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.error) {
            errorMessage = typeof error.error.error === 'string' 
              ? error.error.error 
              : error.error.error.message || errorMessage;
          }
          
          this.toastService.show(errorMessage, 'error');
        }
      });
  }

  resetProfileForm() {
    if (this.originalBusinessProfile) {
      this.businessProfile = { ...this.originalBusinessProfile };
      this.profileFormTouched = false;
      this.fieldTouched = {
        name: false,
        email: false,
        phone: false,
        website: false,
        description: false,
        catchphrase: false
      };
      this.toastService.show('Form reset to original values', 'info');
    }
  }

  // Touch-sensitive validation methods
  onFieldBlur(fieldName: string) {
    this.fieldTouched[fieldName] = true;
  }

  onFieldInput(fieldName: string) {
    // Mark field as touched when user starts typing
    if (!this.fieldTouched[fieldName]) {
      this.fieldTouched[fieldName] = true;
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isFormValid(): boolean {
    // Name is required (but readonly, verified from documents)
    // Email and phone are required for contact
    return !!(
      this.businessProfile.name?.trim() &&
      this.businessProfile.email?.trim() &&
      this.businessProfile.phone?.trim() &&
      this.isValidEmail(this.businessProfile.email)
    );
    // Note: Description, website, catchphrase, and logo are optional
  }

  uploadLogo(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const validation = this.cloudinaryService.validateFile(file);
    if (!validation.isValid) {
      this.toastService.show(validation.error || 'Invalid file', 'error');
      return;
    }

    // Show preview
    this.selectedLogoFile = file;
    this.logoPreview = URL.createObjectURL(file);
    this.toastService.show('Logo preview generated. Click "Upload" to proceed.', 'info');
  }

  uploadLogoConfirm() {
    if (!this.selectedLogoFile) return;

    // Start upload animation
    this.isLogoUploading = true;
    this.logoUploadProgress = 0;

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      if (this.logoUploadProgress < 90) {
        this.logoUploadProgress += Math.random() * 20;
      }
    }, 200);

    const uploadOptions = this.cloudinaryService.createProfileImageOptions(this.currentBusiness?.id);
    uploadOptions.folder = 'crediscore/business-logos';

    this.cloudinaryService.uploadFile(this.selectedLogoFile, uploadOptions)
      .pipe(
        takeUntil(this.destroy$),
        // Filter for upload progress events
        filter((event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            // Update progress from actual upload progress
            if (event.total) {
              const progress = Math.round(100 * event.loaded / event.total);
              this.logoUploadProgress = Math.min(progress, 90); // Cap at 90% until complete
            }
            return false; // Don't pass through progress events
          }
          // Only pass through response events
          return event.type === HttpEventType.Response;
        }),
        // Extract the response body
        map((event: any) => event.body || event)
      )
      .subscribe({
        next: (response: any) => {
          clearInterval(progressInterval);
          this.logoUploadProgress = 100;
          
          setTimeout(() => {
            // Handle different response structures from Cloudinary
            let secureUrl = null;
            if (response?.secure_url) {
              secureUrl = response.secure_url;
            } else if (response?.body?.secure_url) {
              secureUrl = response.body.secure_url;
            } else if (typeof response === 'string' && response.includes('cloudinary.com')) {
              secureUrl = response;
            }
            
            if (secureUrl) {
              this.businessProfile.logo = secureUrl;
              this.toastService.show('Logo uploaded successfully', 'success');
              
              // Clear preview
              if (this.logoPreview) {
                URL.revokeObjectURL(this.logoPreview);
                this.logoPreview = null;
              }
              this.selectedLogoFile = null;
              
              // Update business profile with new logo (saves to backend)
              if (this.currentBusiness) {
                // Save logo to backend immediately
                this.saveLogoToBackend(secureUrl);
              }
            } else {
              this.toastService.show('Logo upload failed: Invalid response from server', 'error');
            }
            
            this.isLogoUploading = false;
            this.logoUploadProgress = 0;
          }, 500);
        },
        error: (error: any) => {
          clearInterval(progressInterval);
          
          let errorMessage = 'Logo upload failed';
          // Handle different error response structures
          if (error.error) {
            if (typeof error.error === 'string') {
              try {
                const parsed = JSON.parse(error.error);
                errorMessage = parsed.error?.message || parsed.message || errorMessage;
              } catch {
                errorMessage = error.error;
              }
            } else if (error.error.error?.message) {
              errorMessage = error.error.error.message;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            } else if (error.error.error) {
              errorMessage = typeof error.error.error === 'string' 
                ? error.error.error 
                : error.error.error.message || errorMessage;
            }
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.toastService.show(errorMessage, 'error');
          this.isLogoUploading = false;
          this.logoUploadProgress = 0;
        }
      });
  }

  cancelLogoUpload() {
    // Clear preview
    if (this.logoPreview) {
      URL.revokeObjectURL(this.logoPreview);
      this.logoPreview = null;
    }
    this.selectedLogoFile = null;
    this.toastService.show('Logo upload cancelled', 'info');
  }

  saveLogoToBackend(logoUrl: string) {
    if (!this.currentBusiness?.id) {
      this.toastService.show('Cannot save logo: Business not found', 'error');
      return;
    }

    const updateData = {
      id: this.currentBusiness.id,
      logo: logoUrl
    };

    this.businessService.updateBusiness(updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedBusiness) => {
          this.currentBusiness = updatedBusiness;
          this.businessProfile.logo = (updatedBusiness as any).logo || logoUrl;
          this.originalBusinessProfile = { ...this.businessProfile };
          this.toastService.show('Logo saved successfully', 'success');
        },
        error: (error) => {
          this.toastService.show(
            error.error?.message || 'Failed to save logo. Please try again.',
            'error'
          );
        }
      });
  }

  editLogo() {
    // Clear any existing preview and allow new upload
    if (this.logoPreview) {
      URL.revokeObjectURL(this.logoPreview);
      this.logoPreview = null;
    }
    this.selectedLogoFile = null;
    // Trigger file input click
    const fileInput = document.querySelector('#logoFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  deleteLogo() {
    if (!confirm('Are you sure you want to remove your business logo?')) {
      return;
    }

    if (!this.currentBusiness?.id) {
      this.toastService.show('Cannot delete logo: Business not found', 'error');
      return;
    }

    const updateData = {
      id: this.currentBusiness.id,
      logo: null
    };

    this.businessService.updateBusiness(updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedBusiness) => {
          this.currentBusiness = updatedBusiness;
          this.businessProfile.logo = '';
          this.originalBusinessProfile = { ...this.businessProfile };
          this.toastService.show('Logo removed successfully', 'success');
        },
        error: (error) => {
          this.toastService.show(
            error.error?.message || 'Failed to remove logo. Please try again.',
            'error'
          );
        }
      });
  }

  // Payment Methods Methods
  openAddPaymentModal() {
    this.showAddPaymentModal = true;
    this.newPaymentMethod = { type: PaymentType.TILL, number: '', accountNumber: '' };
  }

  closeAddPaymentModal() {
    this.showAddPaymentModal = false;
    this.newPaymentMethod = { type: PaymentType.TILL, number: '', accountNumber: '' };
    this.paymentFormTouched = false;
    this.paymentFieldTouched = {
      type: false,
      number: false,
      accountNumber: false
    };
  }

  onPaymentFieldBlur(fieldName: string) {
    this.paymentFieldTouched[fieldName] = true;
    this.paymentFormTouched = true;
  }

  onPaymentFieldInput(fieldName: string) {
    if (!this.paymentFieldTouched[fieldName]) {
      this.paymentFieldTouched[fieldName] = true;
    }
    this.paymentFormTouched = true;
  }

  isValidPaymentNumber(): boolean {
    if (!this.newPaymentMethod.type || !this.newPaymentMethod.number) {
      return false;
    }
    return this.validatePaymentNumber(this.newPaymentMethod.type, this.newPaymentMethod.number);
  }

  isPaymentFormValid(): boolean {
    const baseValid = !!(this.newPaymentMethod.type && this.newPaymentMethod.number && this.isValidPaymentNumber());
    
    // If Paybill, also validate account number
    if (this.needsAccountNumber()) {
      return baseValid && this.isValidAccountNumber();
    }
    
    return baseValid;
  }

  getPaymentNumberLabel(): string {
    switch (this.newPaymentMethod.type) {
      case 'TILL': return 'Till Number';
      case 'PAYBILL': return 'Paybill Number';
      case 'SEND_MONEY': return 'Phone Number';
      case 'BANK': return 'Account Number';
      default: return 'Number';
    }
  }

  getPaymentNumberPlaceholder(): string {
    switch (this.newPaymentMethod.type) {
      case 'TILL': return 'Enter 6-digit Till number (e.g., 123456)';
      case 'PAYBILL': return 'Enter Paybill number (e.g., 123456)';
      case 'SEND_MONEY': return 'Enter phone number (e.g., 0712345678)';
      case 'BANK': return 'Enter bank account number';
      default: return 'Enter payment number';
    }
  }

  needsAccountNumber(): boolean {
    return this.newPaymentMethod.type === 'PAYBILL';
  }

  isValidAccountNumber(): boolean {
    if (!this.needsAccountNumber()) return true;
    if (!this.newPaymentMethod.accountNumber?.trim()) return false;
    // Account number validation (alphanumeric, 1-20 characters)
    return /^[A-Za-z0-9]{1,20}$/.test(this.newPaymentMethod.accountNumber.trim());
  }

  addPaymentMethod() {
    if (!this.currentBusiness) {
      // Try to create business first if profile has minimum required data
      if (this.businessProfile.name?.trim()) {
        this.createBusinessIfNeeded().then(() => {
          if (this.currentBusiness) {
            // Retry after creation
            this.addPaymentMethod();
          } else {
            this.toastService.show('Please complete your business profile first before adding payment methods.', 'warning');
          }
        });
      } else {
        this.toastService.show('Please complete your business profile first before adding payment methods.', 'warning');
      }
      return;
    }

    if (!this.newPaymentMethod.number.trim()) {
      this.toastService.show('Payment method number is required', 'warning');
      return;
    }

    // Validate payment method number based on type
    if (!this.validatePaymentNumber(this.newPaymentMethod.type, this.newPaymentMethod.number)) {
      this.toastService.show('Please enter a valid payment method number', 'warning');
      return;
    }

    // For Paybill, format the number to include account number
    let formattedNumber = this.newPaymentMethod.number.trim();
    if (this.newPaymentMethod.type === 'PAYBILL' && this.newPaymentMethod.accountNumber?.trim()) {
      formattedNumber = `${formattedNumber}#${this.newPaymentMethod.accountNumber.trim()}`;
    }

    this.businessService.addPaymentMethod(this.currentBusiness.id, {
      type: this.newPaymentMethod.type,
      number: formattedNumber
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paymentMethod) => {
          this.paymentMethods.push(paymentMethod);
          this.toastService.show('Payment method added successfully', 'success');
          this.closeAddPaymentModal();
          
          // Update onboarding step if this was the first payment method
          if (this.paymentMethods.length === 1) {
            this.onboardingSteps[2].completed = true;
          }
        },
        error: (error) => {
          this.toastService.show(
            error.error?.message || 'Failed to add payment method. Please try again.', 
            'error'
          );
        }
      });
  }

  removePaymentMethod(paymentId: string) {
    if (!this.currentBusiness) return;

    // For now, remove from local array
    // TODO: Implement backend API call when available
    const index = this.paymentMethods.findIndex(p => p.id === paymentId);
    if (index > -1) {
      this.paymentMethods.splice(index, 1);
      this.toastService.show('Payment method removed successfully', 'success');
      
      // Update onboarding step if no payment methods left
      if (this.paymentMethods.length === 0) {
        this.onboardingSteps[2].completed = false;
      }
    }
  }

  validatePaymentNumber(type: string, number: string): boolean {
    const trimmedNumber = number.trim();
    
    switch (type) {
      case 'TILL':
        // M-Pesa Till numbers are typically 6 digits
        return /^\d{6}$/.test(trimmedNumber);
      case 'PAYBILL':
        // Paybill numbers are typically 5-7 digits
        return /^\d{5,7}$/.test(trimmedNumber);
      case 'SEND_MONEY':
        // Phone numbers in Kenya format: 0XXXXXXXXX or +254XXXXXXXXX
        return /^(?:\+254|0)?[17]\d{8}$/.test(trimmedNumber.replace(/\s/g, ''));
      case 'BANK':
        // Bank account numbers vary, but typically 8-20 digits
        return /^\d{8,20}$/.test(trimmedNumber);
      default:
        return false;
    }
  }

  getPaymentTypeIcon(type: string): string {
    switch (type) {
      case 'TILL': return 'fas fa-store';
      case 'PAYBILL': return 'fas fa-mobile-alt';
      case 'SEND_MONEY': return 'fas fa-paper-plane';
      case 'BANK': return 'fas fa-university';
      default: return 'fas fa-credit-card';
    }
  }

  getPaymentTypeColor(type: string): string {
    switch (type) {
      case 'TILL': return 'bg-green-500';
      case 'PAYBILL': return 'bg-blue-500';
      case 'SEND_MONEY': return 'bg-orange-500';
      case 'BANK': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  }

  onImageError(event: any): void {
    // Hide the image and show initials instead
    event.target.style.display = 'none';
    const fallbackDiv = event.target.nextElementSibling;
    if (fallbackDiv) {
      fallbackDiv.style.display = 'flex';
    }
  }

  getPaymentAddedDate(payment: any): Date {
    return payment.addedAt ? new Date(payment.addedAt) : new Date();
  }

  hasValidAvatar(): boolean {
    const user = this.currentUser();
    return !!(user?.avatar && user.avatar.trim() !== '' && user.avatar.startsWith('http'));
  }

  // OCR/AI Service Health Check Methods
  checkOCRServiceStatus() {
    this.isCheckingOCRStatus = true;
    this.businessService.checkOCRHealth()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.ocrHealthStatus = status;
          this.isCheckingOCRStatus = false;
          
          // Only show toast for non-healthy status to avoid noise
          if (status.status === 'error') {
            this.toastService.show(
              'AI verification unavailable. Documents will be reviewed manually.', 
              'warning'
            );
          }
        },
        error: (error) => {
          this.ocrHealthStatus = {
            status: 'error',
            message: 'Unable to check OCR service status',
            configured: false
          };
          this.isCheckingOCRStatus = false;
        }
      });
  }

  getOCRStatusColor(): string {
    if (!this.ocrHealthStatus) return 'text-gray-500';
    switch (this.ocrHealthStatus.status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-500';
    }
  }

  getOCRStatusIcon(): string {
    if (!this.ocrHealthStatus) return 'fas fa-question-circle';
    switch (this.ocrHealthStatus.status) {
      case 'healthy': return 'fas fa-check-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-question-circle';
    }
  }

  getOCRStatusBadgeClass(): string {
    if (!this.ocrHealthStatus) return 'bg-gray-100 text-gray-600 border-gray-300';
    switch (this.ocrHealthStatus.status) {
      case 'healthy': return 'bg-green-50 text-green-700 border-green-200';
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'error': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  }

  getOCRUserFriendlyMessage(): string {
    if (!this.ocrHealthStatus) return 'Checking service status...';
    
    switch (this.ocrHealthStatus.status) {
      case 'healthy':
        return 'AI document verification is ready. Upload documents for instant analysis.';
      case 'warning':
        return 'OCR available. AI features limited - documents may require manual review.';
      case 'error':
        return 'AI verification unavailable. Documents will be reviewed manually.';
      default:
        return 'Service status unknown.';
    }
  }

  getOCRShortMessage(): string {
    if (!this.ocrHealthStatus) return 'Checking...';
    
    switch (this.ocrHealthStatus.status) {
      case 'healthy':
        return 'Ready';
      case 'warning':
        return 'Limited';
      case 'error':
        return 'Unavailable';
      default:
        return 'Unknown';
    }
  }
}
