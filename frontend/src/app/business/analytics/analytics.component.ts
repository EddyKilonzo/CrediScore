import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BusinessService, Business } from '../../core/services/business.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { I18nService } from '../../core/services/i18n.service';
import { TPipe } from '../../shared/pipes/t.pipe';
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
    imports: [CommonModule, RouterModule, TPipe],
    templateUrl: './analytics.component.html',
    styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    // Inject services
    private authService = inject(AuthService);
    private businessService = inject(BusinessService);
    private toastService = inject(ToastService);
    private i18n = inject(I18nService);

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
    selectedReview: any | null = null;

    // UI state
    isLoading = true;
    selectedPeriod: 'week' | 'month' | '3months' | '6months' | 'year' = '6months';
    readonly trendAxisTicks = [14, 52, 90, 128, 166];
    readonly trendAxisLabels = ['5.0', '4.0', '3.0', '2.0', '1.0'];

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
        return new Date(date).toLocaleDateString(this.i18n.getLocaleFor(this.i18n.currentLanguage()), {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    openReviewDetails(review: any): void {
        this.selectedReview = review;
    }

    closeReviewDetails(): void {
        this.selectedReview = null;
    }

    getReputationLevel(): string {
        const score = this.summary.trustScore;
        if (score >= 80) return this.i18n.t('analytics.reputation.excellent');
        if (score >= 60) return this.i18n.t('analytics.reputation.good');
        if (score >= 40) return this.i18n.t('analytics.reputation.fair');
        if (score >= 20) return this.i18n.t('analytics.reputation.poor');
        return this.i18n.t('analytics.reputation.newBusiness');
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
        const now = new Date();
        const date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const logoUrl = window.location.origin + '/images/CrediScore.png';
        const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const gradeColor = (score: number) =>
            score >= 90 ? '#059669' : score >= 80 ? '#10b981' : score >= 70 ? '#3b82f6' :
            score >= 60 ? '#f59e0b' : score >= 50 ? '#f97316' : '#ef4444';

        const ratingRows = this.ratingDistribution.map(r =>
            `<tr>
              <td style="letter-spacing:1px;color:#f59e0b;">${'★'.repeat(r.rating)}<span style="color:#d1d5db;">${'★'.repeat(5 - r.rating)}</span> <span style="color:#6b7280;font-size:11px;">(${r.rating} star)</span></td>
              <td style="font-weight:600;">${r.count}</td>
              <td style="width:40%;padding-right:16px;">
                <div style="background:#E8EEF3;border-radius:6px;height:10px;">
                  <div style="background:linear-gradient(90deg,#3E6A8A,#2C5270);height:10px;border-radius:6px;width:${r.percentage.toFixed(1)}%;"></div>
                </div>
              </td>
              <td style="font-weight:600;color:#2C5270;">${r.percentage.toFixed(1)}%</td>
            </tr>`
        ).join('');

        const trendRows = this.reviewTrends.map(t =>
            `<tr>
              <td>${t.month}</td>
              <td style="font-weight:600;">${t.count}</td>
              <td style="color:#f59e0b;">${t.averageRating > 0 ? '★ ' + t.averageRating.toFixed(1) : '—'}</td>
            </tr>`
        ).join('');

        const reviewRows = this.recentReviews.slice(0, 10).map(r =>
            `<tr>
              <td style="white-space:nowrap;">${this.formatDate(r.createdAt)}</td>
              <td style="color:#f59e0b;letter-spacing:1px;">${'★'.repeat(r.rating)}<span style="color:#d1d5db;">${'★'.repeat(5 - r.rating)}</span></td>
              <td style="color:#4b5563;">${esc(r.comment || '—')}</td>
            </tr>`
        ).join('');

        const trustGradeColor = gradeColor(this.summary.trustScore);
        const period = this.selectedPeriod === 'month' ? 'Last Month' :
                       this.selectedPeriod === '3months' ? 'Last 3 Months' :
                       this.selectedPeriod === '6months' ? 'Last 6 Months' :
                       this.selectedPeriod === 'year' ? 'Last Year' : this.selectedPeriod;

        const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Analytics Report — ${esc(biz.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; background: #fff; color: #1f2937; }
  .page { max-width: 900px; margin: 0 auto; }

  /* ── Header Banner ── */
  .brand-header {
    background: linear-gradient(135deg, #1a3a52 0%, #2C5270 50%, #3E6A8A 100%);
    padding: 28px 40px 22px;
    display: flex; align-items: center; justify-content: space-between;
    color: white;
  }
  .brand-left { display: flex; align-items: center; gap: 16px; }
  .brand-logo { height: 52px; width: auto; }
  .brand-name { font-size: 26px; font-family: 'Brush Script MT', 'Segoe Script', cursive; color: white; line-height: 1; }
  .brand-tagline { font-size: 11px; color: rgba(255,255,255,0.7); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 3px; }
  .brand-right { text-align: right; }
  .report-title { font-size: 16px; font-weight: 700; color: white; }
  .report-meta { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px; }

  /* ── Subheader strip ── */
  .subheader {
    background: #E8EEF3; padding: 12px 40px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid #c8d8e4;
  }
  .biz-name { font-size: 15px; font-weight: 700; color: #2C5270; }
  .biz-cat { font-size: 12px; color: #5C8BA5; margin-top: 2px; }
  .period-badge {
    background: #2C5270; color: white; font-size: 11px; font-weight: 600;
    padding: 4px 12px; border-radius: 20px; letter-spacing: 0.04em;
  }

  /* ── Body ── */
  .body { padding: 32px 40px 40px; }
  .section-title {
    font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    color: #2C5270; border-left: 4px solid #3E6A8A; padding-left: 10px;
    margin: 28px 0 14px;
  }
  .section-title:first-child { margin-top: 0; }

  /* ── KPI Grid ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .kpi {
    background: #f5f8fb; border: 1px solid #dce8f0; border-radius: 10px;
    padding: 14px 16px; border-top: 3px solid #3E6A8A;
  }
  .kpi-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .kpi-value { font-size: 28px; font-weight: 700; color: #1f2937; margin-top: 6px; line-height: 1; }
  .kpi-sub { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .kpi.accent { border-top-color: #5C8BA5; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: linear-gradient(90deg, #2C5270, #3E6A8A); }
  th { color: white; padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  td { padding: 8px 12px; border-bottom: 1px solid #eef2f5; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:hover td { background: #EFF5F9; }

  /* ── Verified chip ── */
  .chip-verified { display:inline-flex; align-items:center; gap:4px; background:#d1fae5; color:#065f46; font-size:11px; font-weight:600; padding:3px 8px; border-radius:20px; }
  .chip-pending  { display:inline-flex; align-items:center; gap:4px; background:#fef9c3; color:#854d0e; font-size:11px; font-weight:600; padding:3px 8px; border-radius:20px; }

  /* ── Footer ── */
  .pdf-footer {
    background: #f5f8fb; border-top: 2px solid #3E6A8A;
    padding: 14px 40px; display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; color: #6b7280;
  }
  .footer-brand { font-size: 13px; font-family: 'Brush Script MT', cursive; color: #3E6A8A; }
  .footer-conf { font-size: 10px; color: #9ca3af; }

  /* ── Print ── */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 100%; }
  }
  @page { margin: 0; size: A4; }
</style>
</head>
<body>
<div class="page">

  <!-- Brand Header -->
  <div class="brand-header">
    <div class="brand-left">
      <img src="${logoUrl}" alt="CrediScore" class="brand-logo" onerror="this.style.display='none'">
      <div>
        <div class="brand-name">CrediScore</div>
        <div class="brand-tagline">Business Trust Platform</div>
      </div>
    </div>
    <div class="brand-right">
      <div class="report-title">Business Analytics Report</div>
      <div class="report-meta">Generated: ${date}</div>
    </div>
  </div>

  <!-- Sub-header -->
  <div class="subheader">
    <div>
      <div class="biz-name">${esc(biz.name)}</div>
      ${biz.category ? `<div class="biz-cat">${esc(biz.category)}</div>` : ''}
    </div>
    <span class="period-badge">${period}</span>
  </div>

  <div class="body">

    <!-- KPIs -->
    <div class="section-title">Key Metrics</div>
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Total Reviews</div>
        <div class="kpi-value">${this.summary.totalReviews}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Average Rating</div>
        <div class="kpi-value" style="color:#f59e0b;">${this.summary.averageRating.toFixed(1)}<span style="font-size:14px;color:#9ca3af;"> / 5</span></div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Trust Score</div>
        <div class="kpi-value" style="color:${trustGradeColor};">${this.summary.trustScore.toFixed(1)}<span style="font-size:14px;"> %</span></div>
      </div>
      <div class="kpi accent">
        <div class="kpi-label">Verification</div>
        <div style="margin-top:8px;">
          ${this.summary.verificationStatus === 'Verified'
            ? '<span class="chip-verified">✓ Verified</span>'
            : '<span class="chip-pending">⏳ Pending</span>'}
        </div>
      </div>
      <div class="kpi accent">
        <div class="kpi-label">Documents</div>
        <div class="kpi-value">${this.summary.totalDocuments}</div>
      </div>
      <div class="kpi accent">
        <div class="kpi-label">Payments</div>
        <div class="kpi-value">${this.summary.totalPayments}</div>
      </div>
    </div>

    <!-- Rating Distribution -->
    <div class="section-title">Rating Distribution</div>
    <table>
      <thead><tr><th>Stars</th><th>Count</th><th>Distribution</th><th>%</th></tr></thead>
      <tbody>${ratingRows}</tbody>
    </table>

    <!-- Review Trends -->
    <div class="section-title">Monthly Review Trends — ${period}</div>
    <table>
      <thead><tr><th>Month</th><th>Reviews</th><th>Avg Rating</th></tr></thead>
      <tbody>${trendRows || '<tr><td colspan="3" style="text-align:center;color:#9ca3af;padding:20px;">No trend data for this period</td></tr>'}</tbody>
    </table>

    ${this.recentReviews.length > 0 ? `
    <!-- Recent Reviews -->
    <div class="section-title">Recent Reviews (last ${Math.min(this.recentReviews.length, 10)})</div>
    <table>
      <thead><tr><th>Date</th><th>Rating</th><th>Comment</th></tr></thead>
      <tbody>${reviewRows}</tbody>
    </table>` : ''}

  </div><!-- /body -->

  <!-- Footer -->
  <div class="pdf-footer">
    <div>
      <span class="footer-brand">CrediScore</span>
      <span style="margin-left:8px;">Business Analytics Report</span>
    </div>
    <div style="text-align:right;">
      <div>${date}</div>
      <div class="footer-conf">Confidential — For business owner use only</div>
    </div>
  </div>

</div><!-- /page -->
</body></html>`;

        const win = window.open('', '_blank', 'width=1000,height=780');
        if (!win) { this.toastService.error('Pop-ups are blocked. Please allow pop-ups and try again.'); return; }
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 700);
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

    getGradeFromRating(rating: number): string {
        const gradeScore = rating * 20;
        if (gradeScore >= 90) return 'A';
        if (gradeScore >= 80) return 'B';
        if (gradeScore >= 70) return 'C';
        if (gradeScore >= 60) return 'D';
        return 'E';
    }

    getRatingTrendPoints(width = 580, height = 180): string {
        const validTrends = this.reviewTrends.filter(t => t.count > 0);
        if (validTrends.length === 0) return '';
        const layout = this.getTrendLayout(width, height);

        if (validTrends.length === 1) {
            const x = layout.left + layout.plotWidth / 2;
            const y = this.getTrendY(validTrends[0].averageRating, height, 5);
            // Draw a short horizontal segment so single-point data still appears as a line chart.
            return `${Math.round(x - 24)},${Math.round(y)} ${Math.round(x + 24)},${Math.round(y)}`;
        }

        return validTrends.map((trend, index) => {
            const x = layout.left + (index / (validTrends.length - 1)) * layout.plotWidth;
            const y = this.getTrendY(trend.averageRating, height, 5);
            return `${Math.round(x)},${Math.round(y)}`;
        }).join(' ');
    }

    getGradeTrendPoints(width = 580, height = 180): string {
        const validTrends = this.reviewTrends.filter(t => t.count > 0);
        if (validTrends.length === 0) return '';
        const layout = this.getTrendLayout(width, height);

        if (validTrends.length === 1) {
            const x = layout.left + layout.plotWidth / 2;
            const gradeScore = validTrends[0].averageRating * 20;
            const y = this.getTrendY(gradeScore, height, 100);
            return `${Math.round(x - 24)},${Math.round(y)} ${Math.round(x + 24)},${Math.round(y)}`;
        }

        return validTrends.map((trend, index) => {
            const x = layout.left + (index / (validTrends.length - 1)) * layout.plotWidth;
            const gradeScore = trend.averageRating * 20;
            const y = this.getTrendY(gradeScore, height, 100);
            return `${Math.round(x)},${Math.round(y)}`;
        }).join(' ');
    }

    getTrendPointData(width = 580, height = 180): Array<{ month: string; x: number; ratingY: number; gradeY: number; rating: number; grade: string }> {
        const validTrends = this.reviewTrends.filter(t => t.count > 0);
        if (validTrends.length === 0) return [];
        const layout = this.getTrendLayout(width, height);

        return validTrends.map((trend, index) => {
            const x = validTrends.length === 1
                ? layout.left + layout.plotWidth / 2
                : layout.left + (index / (validTrends.length - 1)) * layout.plotWidth;
            const ratingY = this.getTrendY(trend.averageRating, height, 5);
            const gradeScore = trend.averageRating * 20;
            const gradeY = this.getTrendY(gradeScore, height, 100);

            return {
                month: trend.month,
                x: Math.round(x),
                ratingY: Math.round(ratingY),
                gradeY: Math.round(gradeY),
                rating: trend.averageRating,
                grade: this.getGradeFromRating(trend.averageRating)
            };
        });
    }

    private getTrendY(value: number, height: number, max: number): number {
        const clamped = Math.max(0, Math.min(value, max));
        const topPadding = 14;
        const bottomPadding = 14;
        const chartHeight = height - topPadding - bottomPadding;
        return topPadding + (1 - clamped / max) * chartHeight;
    }

    private getTrendLayout(width: number, _height: number): { left: number; right: number; plotWidth: number } {
        const left = 44;
        const right = width - 16;
        return { left, right, plotWidth: right - left };
    }
}
