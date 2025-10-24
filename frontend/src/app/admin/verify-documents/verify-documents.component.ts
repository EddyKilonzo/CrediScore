import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface Document {
  id: number;
  businessName: string;
  businessType: string;
  documentType: 'license' | 'permit' | 'certificate' | 'registration';
  fileName: string;
  fileSize: string;
  uploadDate: Date;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
}

@Component({
  selector: 'app-verify-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-documents.component.html',
  styleUrl: './verify-documents.component.css'
})
export class VerifyDocumentsComponent implements OnInit {
  documents: Document[] = [];
  isLoading = true;
  isProcessing = false;
  error: string | null = null;
  successMessage: string | null = null;

  private readonly API_BASE = 'http://localhost:3000/api/admin/documents';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    this.loadDocuments();
  }

  private async loadDocuments(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      
      const response = await this.http.get<{documents: Document[], pagination: any}>(`${this.API_BASE}/pending`).toPromise();
      
      if (response) {
        this.documents = response.documents.map(doc => ({
          ...doc,
          uploadDate: new Date(doc.uploadDate)
        }));
      }
    } catch (error: any) {
      console.error('Error loading documents:', error);
      
      // Provide friendlier error messages
      if (error.status === 0) {
        this.error = 'Unable to connect to the server. Please check if the backend is running on port 3000.';
      } else if (error.status === 404) {
        this.error = 'Document verification service is not available. Please contact your administrator.';
      } else if (error.status === 401) {
        this.error = 'You are not authorized to access this feature. Please log in as an administrator.';
      } else if (error.status === 403) {
        this.error = 'Access denied. Admin privileges required.';
      } else if (error.status >= 500) {
        this.error = 'Server error occurred. Please try again later or contact support.';
      } else {
        this.error = error.message || 'Failed to load documents. Please try again.';
      }
      
      this.documents = [];
    } finally {
      this.isLoading = false;
    }
  }


  async refreshDocuments(): Promise<void> {
    await this.loadDocuments();
  }

  async viewDocument(docId: number): Promise<void> {
    try {
      // For now, show an alert since document viewing endpoint needs to be implemented
      alert(`Document ${docId} would be opened in a new tab`);
    } catch (error: any) {
      console.error('Error viewing document:', error);
      this.error = error.message || 'Failed to view document';
    }
  }

  async approveDocument(docId: number): Promise<void> {
    try {
      this.isProcessing = true;
      this.error = null;
      
      const response = await this.http.post(`${this.API_BASE}/${docId}/approve`, {}).toPromise();
      
      if (response) {
        this.successMessage = 'Document approved successfully';
        // Remove the document from the list
        this.documents = this.documents.filter(doc => doc.id !== docId);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error approving document:', error);
      
      // Provide friendlier error messages
      if (error.status === 0) {
        this.error = 'Unable to connect to the server. Please check your connection.';
      } else if (error.status === 404) {
        this.error = 'Document not found. It may have already been processed.';
      } else if (error.status === 401) {
        this.error = 'Session expired. Please log in again.';
      } else if (error.status === 403) {
        this.error = 'You do not have permission to approve documents.';
      } else {
        this.error = error.message || 'Failed to approve document. Please try again.';
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async requestRevision(docId: number): Promise<void> {
    try {
      this.isProcessing = true;
      this.error = null;
      
      const response = await this.http.post(`${this.API_BASE}/${docId}/request-revision`, {}).toPromise();
      
      if (response) {
        this.successMessage = 'Revision requested successfully';
        // Update the document status
        const doc = this.documents.find(d => d.id === docId);
        if (doc) {
          doc.status = 'revision_requested';
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error requesting revision:', error);
      this.error = error.message || 'Failed to request revision';
    } finally {
      this.isProcessing = false;
    }
  }

  async rejectDocument(docId: number): Promise<void> {
    try {
      this.isProcessing = true;
      this.error = null;
      
      const response = await this.http.post(`${this.API_BASE}/${docId}/reject`, {}).toPromise();
      
      if (response) {
        this.successMessage = 'Document rejected successfully';
        // Remove the document from the list
        this.documents = this.documents.filter(doc => doc.id !== docId);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error rejecting document:', error);
      this.error = error.message || 'Failed to reject document';
    } finally {
      this.isProcessing = false;
    }
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
