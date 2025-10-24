import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface FraudReport {
  id: string;
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
  reporter: {
    id: string;
    name: string;
    email: string;
    reputation: number;
  };
  business: {
    id: string;
    name: string;
    isVerified: boolean;
    isActive: boolean;
  };
}

@Component({
  selector: 'app-fraud-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fraud-reports.component.html',
  styleUrl: './fraud-reports.component.css'
})
export class FraudReportsComponent implements OnInit {
  reports: FraudReport[] = [];
  isLoading = true;
  error: string | null = null;

  private readonly API_BASE = 'http://localhost:3000/api/admin/fraud-reports';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Scroll to top when component loads
    window.scrollTo(0, 0);
    
    this.loadReports();
  }

  private async loadReports(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = null;
      
      const response = await this.http.get<{reports: FraudReport[], pagination: any}>(this.API_BASE).toPromise();
      
      if (response) {
        this.reports = response.reports.map(report => ({
          ...report,
          createdAt: new Date(report.createdAt)
        }));
      }
    } catch (error: any) {
      console.error('Error loading fraud reports:', error);
      
      // Provide friendlier error messages
      if (error.status === 0) {
        this.error = 'Unable to connect to the server. Please check if the backend is running on port 3000.';
      } else if (error.status === 404) {
        this.error = 'Fraud reports service is not available. Please contact your administrator.';
      } else if (error.status === 401) {
        this.error = 'You are not authorized to access this feature. Please log in as an administrator.';
      } else if (error.status === 403) {
        this.error = 'Access denied. Admin privileges required.';
      } else if (error.status >= 500) {
        this.error = 'Server error occurred. Please try again later or contact support.';
      } else {
        this.error = error.message || 'Failed to load fraud reports. Please try again.';
      }
      
      this.reports = [];
    } finally {
      this.isLoading = false;
    }
  }

  async refreshReports(): Promise<void> {
    await this.loadReports();
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  reviewReport(reportId: string): void {
    console.log('Reviewing report:', reportId);
    // Implement review logic
  }

  dismissReport(reportId: string): void {
    console.log('Dismissing report:', reportId);
    // Implement dismiss logic
  }
}
