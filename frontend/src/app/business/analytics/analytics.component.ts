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
