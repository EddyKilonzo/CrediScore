import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AuthService } from '../../core/services/auth.service';

interface Document {
  id: string;
  businessName: string;
  businessType: string;
  businessOwner: {
    id: string;
    name: string;
    email: string;
  };
  documentType: 'LICENSE' | 'PERMIT' | 'CERTIFICATE' | 'REGISTRATION' | string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  url: string;
  verified: boolean;
  aiVerified: boolean;
  aiAnalysis?: any;
  extractedData?: any;
  ocrText?: string;
  ocrConfidence?: number;
  aiVerifiedAt?: Date;
  verificationNotes?: string;
  verifiedAt?: Date;
  verifiedBy?: string;
}

@Component({
  selector: 'app-verify-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-documents.component.html',
  styleUrl: './verify-documents.component.css'
})
export class VerifyDocumentsComponent implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private adminService = inject(AdminService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  // Component state
  documents = signal<Document[]>([]);
  selectedDocument = signal<Document | null>(null);
  isLoading = signal(false);
  isProcessing = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  showAIInsights = signal(false);

  private readonly API_BASE = 'http://localhost:3000/api/admin/documents';

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    // Check if user is admin
    if (!this.isAuthenticated() || !this.isAdmin()) {
      window.location.href = '/dashboard';
      return;
    }

    this.loadDocuments();
  }

  private isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  private async loadDocuments(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const token = localStorage.getItem('token');
      const headers = token 
        ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
        : undefined;

      const response = await this.http.get<any>(`${this.API_BASE}/pending`, { headers }).toPromise();
      
      if (response) {
        this.documents.set(response.documents.map((doc: any) => ({
          ...doc,
          uploadDate: new Date(doc.uploadDate)
        })));
      }
    } catch (error: any) {
      console.error('Error loading documents:', error);
      
      if (error.status === 0) {
        this.error.set('Unable to connect to the server. Please check if the backend is running on port 3000.');
      } else if (error.status === 404) {
        this.error.set('Document verification service is not available. Please contact your administrator.');
      } else if (error.status === 401) {
        this.error.set('You are not authorized to access this feature. Please log in as an administrator.');
      } else if (error.status === 403) {
        this.error.set('Access denied. Admin privileges required.');
      } else if (error.status >= 500) {
        this.error.set('Server error occurred. Please try again later or contact support.');
      } else {
        this.error.set(error.message || 'Failed to load documents. Please try again.');
      }
      
      this.documents.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshDocuments(): Promise<void> {
    await this.loadDocuments();
  }

  async viewDocument(doc: Document): Promise<void> {
    try {
      // Open document in new tab
      window.open(doc.url, '_blank');
      this.selectedDocument.set(doc);
      this.showAIInsights.set(true);
    } catch (error: any) {
      console.error('Error viewing document:', error);
      this.error.set(error.message || 'Failed to view document');
    }
  }

  getVerificationConfidence(doc: Document): number {
    // Calculate overall confidence based on AI verification, OCR confidence, and extracted data
    let confidence = 0;
    
    if (doc.aiVerified) confidence += 40;
    if (doc.ocrConfidence) confidence += (doc.ocrConfidence * 0.3);
    if (doc.extractedData && Object.keys(doc.extractedData).length > 0) confidence += 30;
    
    return Math.min(confidence, 100);
  }

  getVerificationRecommendation(doc: Document): string {
    const confidence = this.getVerificationConfidence(doc);
    
    if (confidence >= 80) {
      return 'High confidence - Approve recommended';
    } else if (confidence >= 60) {
      return 'Moderate confidence - Review carefully before approval';
    } else if (confidence >= 40) {
      return 'Low confidence - Request revision or reject';
    } else {
      return 'Very low confidence - Reject or request better quality document';
    }
  }

  shouldAutoApprove(doc: Document): boolean {
    return this.getVerificationConfidence(doc) >= 80 && doc.aiVerified;
  }

  async approveDocument(doc: Document): Promise<void> {
    try {
      this.isProcessing.set(true);
      this.error.set(null);
      
      const token = localStorage.getItem('token');
      const headers = token 
        ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
        : undefined;

      const response = await this.http.post(
        `${this.API_BASE}/${doc.id}/approve`, 
        {},
        { headers }
      ).toPromise();
      
      if (response) {
        this.successMessage.set('Document approved successfully');
        this.toastService.success('Document approved successfully');
        this.documents.update(docs => docs.filter(d => d.id !== doc.id));
        
        setTimeout(() => {
          this.successMessage.set(null);
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error approving document:', error);
      
      if (error.status === 0) {
        this.error.set('Unable to connect to the server. Please check your connection.');
      } else if (error.status === 404) {
        this.error.set('Document not found. It may have already been processed.');
      } else if (error.status === 401) {
        this.error.set('Session expired. Please log in again.');
      } else if (error.status === 403) {
        this.error.set('You do not have permission to approve documents.');
      } else {
        this.error.set(error.message || 'Failed to approve document. Please try again.');
      }
      this.toastService.error('Failed to approve document');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async approveWithAI(doc: Document): Promise<void> {
    if (this.shouldAutoApprove(doc)) {
      await this.approveDocument(doc);
    } else {
      this.toastService.info('AI confidence too low. Please review manually.');
    }
  }

  async requestRevision(doc: Document): Promise<void> {
    try {
      this.isProcessing.set(true);
      this.error.set(null);
      
      const token = localStorage.getItem('token');
      const headers = token 
        ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
        : undefined;

      const response = await this.http.post(
        `${this.API_BASE}/${doc.id}/request-revision`, 
        {},
        { headers }
      ).toPromise();
      
      if (response) {
        this.successMessage.set('Revision requested successfully');
        this.toastService.success('Revision requested');
        this.documents.update(docs => 
          docs.map(d => d.id === doc.id ? { ...d, verified: false } : d)
        );
        
        setTimeout(() => {
          this.successMessage.set(null);
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error requesting revision:', error);
      this.error.set(error.message || 'Failed to request revision');
      this.toastService.error('Failed to request revision');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async rejectDocument(doc: Document): Promise<void> {
    if (!confirm('Are you sure you want to reject this document?')) {
      return;
    }

    try {
      this.isProcessing.set(true);
      this.error.set(null);
      
      const token = localStorage.getItem('token');
      const headers = token 
        ? new HttpHeaders().set('Authorization', `Bearer ${token}`)
        : undefined;

      const response = await this.http.post(
        `${this.API_BASE}/${doc.id}/reject`, 
        {},
        { headers }
      ).toPromise();
      
      if (response) {
        this.successMessage.set('Document rejected successfully');
        this.toastService.success('Document rejected');
        this.documents.update(docs => docs.filter(d => d.id !== doc.id));
        
        setTimeout(() => {
          this.successMessage.set(null);
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error rejecting document:', error);
      this.error.set(error.message || 'Failed to reject document');
      this.toastService.error('Failed to reject document');
    } finally {
      this.isProcessing.set(false);
    }
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}

