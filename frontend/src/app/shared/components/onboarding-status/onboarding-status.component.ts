import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BusinessService, Document, DocumentType, BusinessStatus } from '../../services/business.service';
import { ToastService } from '../toast/toast.service';
import { Subject, takeUntil, interval } from 'rxjs';

export interface OnboardingProgress {
  currentStep: number;
  status: BusinessStatus;
  submittedForReview: boolean;
  documents: {
    uploaded: number;
    verified: number;
    aiVerified: number;
    required: number;
    missing: string[];
  };
  payments: {
    uploaded: number;
    verified: number;
  };
  canSubmit: boolean;
}

@Component({
  selector: 'app-onboarding-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="onboarding-status-card bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Business Verification</h3>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 rounded-full" 
               [class]="getStatusColor()"></div>
          <span class="text-sm font-medium" [class]="getStatusTextColor()">
            {{ getStatusText() }}
          </span>
        </div>
      </div>

      <!-- Progress Steps -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Progress</span>
          <span class="text-sm text-gray-500">{{ progress?.currentStep || 0 }}/4 steps</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
               [style.width.%]="getProgressPercentage()"></div>
        </div>
      </div>

      <!-- Document Upload Section -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-md font-medium text-gray-900">Document Verification</h4>
          <span class="text-sm text-gray-500">{{ progress?.documents?.uploaded ?? 0 }}/{{ progress?.documents?.required ?? 1 }} uploaded</span>
        </div>

        <!-- Document Status -->
        <div *ngIf="documents && documents.length > 0" class="space-y-3">
          <div *ngFor="let doc of documents" 
               class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center"
                   [class]="getDocumentStatusColor(doc)">
                <i [class]="getDocumentStatusIcon(doc)" class="text-sm"></i>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ getDocumentTypeName(doc.type) }}</p>
                <p class="text-xs text-gray-500">{{ formatDate(doc.uploadedAt) }}</p>
              </div>
            </div>
            <div class="text-right">
              <div class="flex items-center space-x-2">
                <!-- AI Verification Status -->
                <div *ngIf="doc.aiAnalysis" class="flex items-center space-x-1">
                  <i class="fas fa-robot text-xs" 
                     [class]="doc.aiVerified ? 'text-green-500' : 'text-red-500'"></i>
                  <span class="text-xs font-medium"
                        [class]="doc.aiVerified ? 'text-green-600' : 'text-red-600'">
                    {{ doc.aiVerified ? 'AI Verified' : 'AI Failed' }}
                  </span>
                </div>
                <!-- Manual Verification Status -->
                <div class="flex items-center space-x-1">
                  <i class="fas fa-user-check text-xs" 
                     [class]="doc.verified ? 'text-green-500' : 'text-gray-400'"></i>
                  <span class="text-xs font-medium"
                        [class]="doc.verified ? 'text-green-600' : 'text-gray-500'">
                    {{ doc.verified ? 'Verified' : 'Pending' }}
                  </span>
                </div>
              </div>
              <!-- OCR Confidence -->
              <div *ngIf="doc.ocrConfidence" class="text-xs text-gray-500 mt-1">
                OCR: {{ doc.ocrConfidence }}%
              </div>
            </div>
          </div>
        </div>

        <!-- Upload Document Button -->
        <div *ngIf="!documents || documents.length === 0" class="text-center py-6">
          <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <i class="fas fa-upload text-2xl text-gray-400"></i>
          </div>
          <p class="text-sm text-gray-600 mb-4">Upload your business document for verification</p>
          <button (click)="uploadDocument()" 
                  class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <i class="fas fa-upload mr-2"></i>
            Upload Document
          </button>
        </div>

        <!-- Processing Status -->
        <div *ngIf="isProcessing" class="mt-4 p-3 bg-blue-50 rounded-lg">
          <div class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span class="text-sm text-blue-700">AI is analyzing your document...</span>
          </div>
        </div>
      </div>

      <!-- Payment Methods Section -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-md font-medium text-gray-900">Payment Methods</h4>
          <span class="text-sm text-gray-500">{{ progress?.payments?.uploaded ?? 0 }} added</span>
        </div>
        
        <div *ngIf="payments && payments.length > 0" class="space-y-2">
          <div *ngFor="let payment of payments" 
               class="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div class="flex items-center space-x-2">
              <i class="fas fa-credit-card text-sm text-gray-500"></i>
              <span class="text-sm text-gray-900">{{ payment.type }}: {{ payment.number }}</span>
            </div>
            <span class="text-xs px-2 py-1 rounded-full"
                  [class]="payment.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'">
              {{ payment.verified ? 'Verified' : 'Pending' }}
            </span>
          </div>
        </div>

        <button *ngIf="!payments || payments.length === 0" 
                (click)="addPaymentMethod()"
                class="w-full mt-2 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          <i class="fas fa-plus mr-2"></i>
          Add Payment Method
        </button>
      </div>

      <!-- Submit for Review Button -->
      <div *ngIf="progress?.canSubmit && !progress?.submittedForReview" class="text-center">
        <button (click)="submitForReview()" 
                class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
          <i class="fas fa-check mr-2"></i>
          Submit for Review
        </button>
      </div>

      <!-- Review Status -->
      <div *ngIf="progress?.submittedForReview" class="text-center py-4">
        <div class="w-12 h-12 mx-auto mb-3 bg-yellow-100 rounded-full flex items-center justify-center">
          <i class="fas fa-clock text-yellow-600"></i>
        </div>
        <p class="text-sm font-medium text-gray-900">Under Review</p>
        <p class="text-xs text-gray-500">Your business is being reviewed by our admin team</p>
      </div>
    </div>
  `,
  styles: [`
    .onboarding-status-card {
      transition: all 0.3s ease;
    }
    
    .onboarding-status-card:hover {
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
  `]
})
export class OnboardingStatusComponent implements OnInit, OnDestroy {
  @Input() businessId!: string;
  
  private destroy$ = new Subject<void>();
  private businessService = inject(BusinessService);
  private toastService = inject(ToastService);

  progress: OnboardingProgress | null = null;
  documents: Document[] = [];
  payments: any[] = [];
  isProcessing = false;

  ngOnInit() {
    this.loadOnboardingStatus();
    
    // Poll for updates every 5 seconds if processing
    interval(5000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.isProcessing) {
        this.loadOnboardingStatus();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOnboardingStatus() {
    this.businessService.getOnboardingStatus(this.businessId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.progress = response.progress;
          this.documents = response.business.documents || [];
          this.payments = response.business.payments || [];
          
          // Check if any document is being processed
          this.isProcessing = this.documents.some(doc => !doc.aiAnalysis);
        },
        error: (error) => {
          console.error('Error loading onboarding status:', error);
          this.toastService.show('Error loading verification status', 'error');
        }
      });
  }

  uploadDocument() {
    // This would typically open a file upload dialog
    // For now, we'll show a message
    this.toastService.show('Document upload feature coming soon', 'info');
  }

  addPaymentMethod() {
    // This would typically open a payment method form
    this.toastService.show('Payment method form coming soon', 'info');
  }

  submitForReview() {
    this.businessService.submitForReview(this.businessId, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show('Business submitted for review successfully', 'success');
          this.loadOnboardingStatus();
        },
        error: (error: any) => {
          console.error('Error submitting for review:', error);
          this.toastService.show('Error submitting for review', 'error');
        }
      });
  }

  getStatusColor(): string {
    if (!this.progress) return 'bg-gray-400';
    
    switch (this.progress.status) {
      case 'VERIFIED': return 'bg-green-500';
      case 'UNDER_REVIEW': return 'bg-yellow-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  }

  getStatusTextColor(): string {
    if (!this.progress) return 'text-gray-600';
    
    switch (this.progress.status) {
      case 'VERIFIED': return 'text-green-600';
      case 'UNDER_REVIEW': return 'text-yellow-600';
      case 'REJECTED': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  getStatusText(): string {
    if (!this.progress) return 'Unknown';
    
    switch (this.progress.status) {
      case 'VERIFIED': return 'Verified';
      case 'UNDER_REVIEW': return 'Under Review';
      case 'REJECTED': return 'Rejected';
      case 'PENDING': return 'Pending';
      case 'DOCUMENTS_REQUIRED': return 'Documents Required';
      default: return 'Unknown';
    }
  }

  getProgressPercentage(): number {
    if (!this.progress) return 0;
    return (this.progress.currentStep / 4) * 100;
  }

  getDocumentStatusColor(doc: Document): string {
    if (doc.verified) return 'bg-green-100';
    if (doc.aiVerified) return 'bg-blue-100';
    if (doc.aiAnalysis) return 'bg-yellow-100';
    return 'bg-gray-100';
  }

  getDocumentStatusIcon(doc: Document): string {
    if (doc.verified) return 'fas fa-check text-green-600';
    if (doc.aiVerified) return 'fas fa-robot text-blue-600';
    if (doc.aiAnalysis) return 'fas fa-clock text-yellow-600';
    return 'fas fa-upload text-gray-600';
  }

  getDocumentTypeName(type: DocumentType): string {
    switch (type) {
      case DocumentType.BUSINESS_DOCUMENT: return 'Business Document';
      case DocumentType.BUSINESS_REGISTRATION: return 'Business Registration';
      case DocumentType.TAX_CERTIFICATE: return 'Tax Certificate';
      case DocumentType.TRADE_LICENSE: return 'Trade License';
      case DocumentType.BANK_STATEMENT: return 'Bank Statement';
      case DocumentType.UTILITY_BILL: return 'Utility Bill';
      case DocumentType.ID_COPY: return 'ID Copy';
      case DocumentType.PROOF_OF_ADDRESS: return 'Proof of Address';
      default: return 'Other Document';
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }
}
