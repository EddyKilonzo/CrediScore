import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService, Business } from '../../core/services/business.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { environment } from '../../../environments/environment';
import { Subject, takeUntil } from 'rxjs';

interface AnalyticsSummary {
    totalReviews: number;
    averageRating: number;
    trustScore: number;
    verificationStatus: string;
    totalDocuments: number;
    totalPayments: number;
}

interface ReviewTrend {
    month: string;
    count: number;
    averageRating: number;
}

interface RatingDistribution {
    rating: number;
    count: number;
    percentage: number;
}

@Component({
    selector: 'app-analytics',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './analytics.component.html',
    styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    // Inject services
    private authService = inject(AuthService);
    private businessService = inject(BusinessService);
    private toastService = inject(ToastService);

    // Authentication state
    currentUser = this.authService.currentUser;

    // Business data
    currentBusiness: Business | null = null;
    readonly apiUrl = environment.apiUrl;

    // Analytics data
    summary: AnalyticsSummary = {
        totalReviews: 0,
        averageRating: 0,
        trustScore: 0,
        verificationStatus: 'Pending',
        totalDocuments: 0,
        totalPayments: 0
    };

    reviewTrends: ReviewTrend[] = [];
    ratingDistribution: RatingDistribution[] = [];
    recentReviews: any[] = [];

    // UI state
    isLoading = true;
    selectedPeriod: 'week' | 'month' | '3months' | '6months' | 'year' = '6months';

    ngOnInit() {
        this.loadBusinessData();
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
                        this.loadAnalyticsData();
                    } else {
                        this.isLoading = false;
                        this.toastService.show('No business found. Please create a business first.', 'warning');
                    }
                },
                error: (error: any) => {
                    this.isLoading = false;
                    const errorMessage = error.error?.message || error.message || 'Failed to load business data';
                    this.toastService.show(errorMessage, 'error');
                }
            });
    }

    private loadAnalyticsData() {
        if (!this.currentBusiness?.id) {
            this.isLoading = false;
            return;
        }

        // Load business details with reviews
        this.businessService.getBusinessById(this.currentBusiness.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (business) => {
                    this.currentBusiness = business;
                    this.calculateAnalytics(business);
                    this.isLoading = false;
                },
                error: (error) => {
                    this.isLoading = false;
                    const errorMessage = error?.error?.message || error?.message || 'Failed to load analytics data';
                    this.toastService.show(errorMessage, 'error');
                }
            });
    }

    private calculateAnalytics(business: Business) {
        // Calculate summary
        const reviews = (business as any).reviews || [];
        const activeReviews = reviews.filter((r: any) => r.isActive);

        // Get trust score properly
        const trustScore = typeof business.trustScore === 'object' && business.trustScore !== null
            ? (business.trustScore as any).score || 0
            : business.trustScore || 0;

        this.summary = {
            totalReviews: activeReviews.length,
            averageRating: activeReviews.length > 0
                ? activeReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / activeReviews.length
                : 0,
            trustScore: trustScore,
            verificationStatus: business.isVerified ? 'Verified' : 'Pending',
            totalDocuments: (business as any).documents?.length || 0,
            totalPayments: business.payments?.length || 0
        };

        // Calculate rating distribution
        this.calculateRatingDistribution(activeReviews);

        // Calculate review trends
        this.calculateReviewTrends(activeReviews);

        // Get recent reviews (last 10)
        this.recentReviews = activeReviews
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10);
    }

    private calculateRatingDistribution(reviews: any[]) {
        const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        reviews.forEach(review => {
            distribution[review.rating]++;
        });

        this.ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
            rating,
            count: distribution[rating],
            percentage: reviews.length > 0 ? (distribution[rating] / reviews.length) * 100 : 0
        }));
    }

    private calculateReviewTrends(reviews: any[]) {
        const monthsAgo = this.selectedPeriod === 'week' ? 0 :
            this.selectedPeriod === 'month' ? 1 :
                this.selectedPeriod === '3months' ? 3 :
                    this.selectedPeriod === 'year' ? 12 : 6;

        const trends: { [key: string]: { count: number; totalRating: number } } = {};
        const now = new Date();

        // Initialize months
        for (let i = monthsAgo - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            trends[key] = { count: 0, totalRating: 0 };
        }

        // Aggregate reviews by month
        reviews.forEach(review => {
            const reviewDate = new Date(review.createdAt);
            const key = reviewDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

            if (trends[key]) {
                trends[key].count++;
                trends[key].totalRating += review.rating;
            }
        });

        // Convert to array
        this.reviewTrends = Object.entries(trends).map(([month, data]) => ({
            month,
            count: data.count,
            averageRating: data.count > 0 ? data.totalRating / data.count : 0
        }));
    }

    changePeriod(period: 'week' | 'month' | '3months' | '6months' | 'year') {
        this.selectedPeriod = period;
        if (this.currentBusiness) {
            this.calculateAnalytics(this.currentBusiness);
        }
    }

    getStarArray(rating: number): number[] {
        return Array(5).fill(0).map((_, i) => i < Math.round(rating) ? 1 : 0);
    }

    formatDate(date: string): string {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    getReputationLevel(): string {
        const score = this.summary.trustScore;
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        if (score >= 20) return 'Poor';
        return 'New Business';
    }

    getReputationColor(): string {
        const score = this.summary.trustScore;
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-blue-600';
        if (score >= 40) return 'text-yellow-600';
        if (score >= 20) return 'text-orange-600';
        return 'text-gray-600';
    }

    // ─── Exports ────────────────────────────────────────────────────────────

    async downloadCSV(): Promise<void> {
        if (!this.currentBusiness?.id) return;
        const token = this.authService.getToken();
        const url = `${this.apiUrl}/api/business/${this.currentBusiness.id}/export/analytics`;
        try {
            const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `analytics-${this.currentBusiness.name}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
            this.toastService.success('CSV downloaded successfully');
        } catch {
            this.toastService.error('Failed to download CSV. Please try again.');
        }
    }

    downloadPDF(): void {
        const biz = this.currentBusiness;
        if (!biz) return;
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const ratingRows = this.ratingDistribution.map(r =>
            `<tr>
              <td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} (${r.rating})</td>
              <td>${r.count}</td>
              <td><div style="background:#e5e7eb;border-radius:4px;height:8px;width:100%;"><div style="background:#2C5270;height:8px;border-radius:4px;width:${r.percentage.toFixed(1)}%;"></div></div></td>
              <td>${r.percentage.toFixed(1)}%</td>
            </tr>`
        ).join('');

        const trendRows = this.reviewTrends.map(t =>
            `<tr><td>${t.month}</td><td>${t.count}</td><td>${t.averageRating > 0 ? t.averageRating.toFixed(1) : '—'}</td></tr>`
        ).join('');

        const reviewRows = this.recentReviews.slice(0, 10).map(r =>
            `<tr>
              <td>${this.formatDate(r.createdAt)}</td>
              <td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
              <td>${(r.comment || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>`
        ).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Analytics Report — ${biz.name}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; }
  .page { max-width: 860px; margin: auto; padding: 36px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2C5270; padding-bottom: 16px; margin-bottom: 28px; }
  .brand { font-size: 22px; font-weight: 700; color: #2C5270; }
  .subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .meta { text-align: right; font-size: 12px; color: #6b7280; }
  .section-title { font-size: 15px; font-weight: 700; color: #2C5270; border-left: 4px solid #2C5270; padding-left: 10px; margin: 28px 0 14px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 8px; }
  .kpi { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
  .kpi-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
  .kpi-value { font-size: 26px; font-weight: 700; color: #1f2937; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  th { background: #2C5270; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body><div class="page">
  <div class="header">
    <div>
      <div class="brand">CrediScore — Business Analytics</div>
      <div class="subtitle">${biz.name}${biz.category ? ' · ' + biz.category : ''}</div>
    </div>
    <div class="meta">Period: ${this.selectedPeriod}<br>Generated: ${date}</div>
  </div>

  <div class="section-title">Key Metrics</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Total Reviews</div><div class="kpi-value">${this.summary.totalReviews}</div></div>
    <div class="kpi"><div class="kpi-label">Avg Rating</div><div class="kpi-value">${this.summary.averageRating.toFixed(1)} / 5</div></div>
    <div class="kpi"><div class="kpi-label">Trust Score</div><div class="kpi-value">${this.summary.trustScore.toFixed(1)}%</div></div>
    <div class="kpi"><div class="kpi-label">Verification</div><div class="kpi-value" style="font-size:16px;">${this.summary.verificationStatus}</div></div>
    <div class="kpi"><div class="kpi-label">Documents</div><div class="kpi-value">${this.summary.totalDocuments}</div></div>
    <div class="kpi"><div class="kpi-label">Payments</div><div class="kpi-value">${this.summary.totalPayments}</div></div>
  </div>

  <div class="section-title">Rating Distribution</div>
  <table><thead><tr><th>Stars</th><th>Count</th><th>Bar</th><th>%</th></tr></thead>
  <tbody>${ratingRows}</tbody></table>

  <div class="section-title">Review Trends</div>
  <table><thead><tr><th>Month</th><th>Reviews</th><th>Avg Rating</th></tr></thead>
  <tbody>${trendRows}</tbody></table>

  ${this.recentReviews.length > 0 ? `
  <div class="section-title">Recent Reviews (last 10)</div>
  <table><thead><tr><th>Date</th><th>Rating</th><th>Comment</th></tr></thead>
  <tbody>${reviewRows}</tbody></table>` : ''}

  <div class="footer">
    <span>CrediScore Business Analytics Report</span>
    <span>${date}</span>
  </div>
</div></body></html>`;

        const win = window.open('', '_blank', 'width=960,height=720');
        if (!win) { this.toastService.error('Pop-ups are blocked. Please allow pop-ups and try again.'); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 600);
    }

    getMaxTrendCount(): number {
        return Math.max(...this.reviewTrends.map(t => t.count), 1);
    }

    getTrendBarHeight(count: number): number {
        return count > 0 ? Math.max(6, Math.round((count / this.getMaxTrendCount()) * 140)) : 4;
    }

    getTotalTrendReviews(): number {
        return this.reviewTrends.reduce((s, t) => s + t.count, 0);
    }
}
