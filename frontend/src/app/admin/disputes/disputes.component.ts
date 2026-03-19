import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface ReviewFlag {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  review: { id: string; rating: number; comment: string; business: { id: string; name: string } };
  user: { id: string; name: string; email: string };
}

interface ReviewDispute {
  id: string;
  reason: string;
  status: string;
  adminNote?: string;
  createdAt: string;
  review: { id: string; rating: number; comment: string; business: { id: string; name: string } };
  user: { id: string; name: string; email: string };
}

@Component({
  selector: 'app-disputes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './disputes.component.html',
  styleUrl: './disputes.component.css'
})
export class DisputesComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/admin';

  activeTab: 'flags' | 'disputes' = 'flags';

  flags: ReviewFlag[] = [];
  flagsLoading = true;
  flagsError: string | null = null;
  flagStatusFilter = '';

  disputes: ReviewDispute[] = [];
  disputesLoading = true;
  disputesError: string | null = null;
  disputeStatusFilter = '';

  // Resolve modal
  resolving: { type: 'flag' | 'dispute'; item: any } | null = null;
  resolveAction = '';
  resolveNote = '';
  isResolving = false;

  ngOnInit() {
    this.loadFlags();
    this.loadDisputes();
  }

  loadFlags() {
    this.flagsLoading = true;
    const params = this.flagStatusFilter ? `?status=${this.flagStatusFilter}` : '';
    this.http.get<any>(`${this.API_URL}/review-flags${params}`).subscribe({
      next: (res) => { this.flags = res.flags || []; this.flagsLoading = false; },
      error: () => { this.flagsError = 'Failed to load review flags.'; this.flagsLoading = false; }
    });
  }

  loadDisputes() {
    this.disputesLoading = true;
    const params = this.disputeStatusFilter ? `?status=${this.disputeStatusFilter}` : '';
    this.http.get<any>(`${this.API_URL}/disputes${params}`).subscribe({
      next: (res) => { this.disputes = res.disputes || []; this.disputesLoading = false; },
      error: () => { this.disputesError = 'Failed to load disputes.'; this.disputesLoading = false; }
    });
  }

  openResolve(type: 'flag' | 'dispute', item: any) {
    this.resolving = { type, item };
    this.resolveAction = type === 'flag' ? 'REVIEWED' : 'RESOLVED';
    this.resolveNote = '';
  }

  closeResolve() {
    this.resolving = null;
    this.resolveAction = '';
    this.resolveNote = '';
    this.isResolving = false;
  }

  submitResolve() {
    if (!this.resolving || !this.resolveAction || this.isResolving) return;
    this.isResolving = true;
    const { type, item } = this.resolving;

    if (type === 'flag') {
      this.http.patch(`${this.API_URL}/review-flags/${item.id}/resolve`, { action: this.resolveAction }).subscribe({
        next: () => {
          this.flags = this.flags.map(f => f.id === item.id ? { ...f, status: this.resolveAction } : f);
          this.closeResolve();
        },
        error: () => { this.isResolving = false; }
      });
    } else {
      this.http.patch(`${this.API_URL}/disputes/${item.id}/resolve`, { action: this.resolveAction, adminNote: this.resolveNote }).subscribe({
        next: () => {
          this.disputes = this.disputes.map(d => d.id === item.id ? { ...d, status: this.resolveAction, adminNote: this.resolveNote } : d);
          this.closeResolve();
        },
        error: () => { this.isResolving = false; }
      });
    }
  }

  getStatusColor(status: string): string {
    if (status === 'PENDING') return '#f59e0b';
    if (status === 'REVIEWED' || status === 'RESOLVED') return '#10b981';
    if (status === 'DISMISSED') return '#64748b';
    if (status === 'UNDER_REVIEW') return '#3b82f6';
    return '#64748b';
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
