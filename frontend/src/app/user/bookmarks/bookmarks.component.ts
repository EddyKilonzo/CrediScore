import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReviewService } from '../../core/services/review.service';
import { TPipe } from '../../shared/pipes/t.pipe';

interface BookmarkedBusiness {
  id: string;
  businessId: string;
  createdAt: string;
  business: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    location?: string;
    logo?: string;
    isVerified: boolean;
    trustScore?: { grade: string; score: number };
  };
  tags?: string[];
}

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TPipe],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.css'
})
export class BookmarksComponent implements OnInit {
  private reviewService = inject(ReviewService);

  bookmarks: BookmarkedBusiness[] = [];
  isLoading = true;
  error: string | null = null;
  removingId: string | null = null;
  currentPage = 1;
  totalPages = 1;
  selectedBusinessIds = new Set<string>();
  bulkTag = '';
  tagDrafts: Record<string, string> = {};
  alertsByBusiness: Record<string, { minTrustScore?: number; maxAverageSpend?: number; isActive?: boolean }> = {};
  recommendations: any[] = [];

  ngOnInit() {
    this.loadBookmarks();
    this.loadAlerts();
    this.loadRecommendations();
  }

  loadBookmarks() {
    this.isLoading = true;
    this.reviewService.getBookmarks(this.currentPage).subscribe({
      next: (res) => {
        this.bookmarks = res.bookmarks || res.data || [];
        this.totalPages = res.pagination?.totalPages || 1;
        this.selectedBusinessIds.clear();
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load bookmarks.';
        this.isLoading = false;
      }
    });
  }

  removeBookmark(businessId: string) {
    this.removingId = businessId;
    this.reviewService.removeBookmark(businessId).subscribe({
      next: () => {
        this.bookmarks = this.bookmarks.filter(b => b.business.id !== businessId);
        this.removingId = null;
      },
      error: () => { this.removingId = null; }
    });
  }

  toggleSelected(businessId: string, checked: boolean) {
    if (checked) this.selectedBusinessIds.add(businessId);
    else this.selectedBusinessIds.delete(businessId);
  }

  runBulkRemove() {
    const ids = Array.from(this.selectedBusinessIds);
    if (!ids.length) return;
    this.reviewService.bulkBookmarkAction({ businessIds: ids, action: 'remove' }).subscribe({
      next: () => this.loadBookmarks(),
    });
  }

  runBulkTag() {
    const ids = Array.from(this.selectedBusinessIds);
    const tag = this.bulkTag.trim().toLowerCase();
    if (!ids.length || !tag) return;
    this.reviewService.bulkBookmarkAction({ businessIds: ids, action: 'tag', tag }).subscribe({
      next: () => {
        this.bulkTag = '';
        this.loadBookmarks();
      },
    });
  }

  saveTags(bm: BookmarkedBusiness) {
    const draft = this.tagDrafts[bm.business.id] ?? (bm.tags || []).join(', ');
    const tags = draft
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    this.reviewService.setBookmarkTags(bm.business.id, tags).subscribe({
      next: () => this.loadBookmarks(),
    });
  }

  private loadAlerts() {
    this.reviewService.getPriceScoreAlerts().subscribe({
      next: (alerts) => {
        this.alertsByBusiness = {};
        for (const alert of alerts || []) {
          this.alertsByBusiness[alert.businessId] = {
            minTrustScore: alert.minTrustScore ?? undefined,
            maxAverageSpend: alert.maxAverageSpend ?? undefined,
            isActive: alert.isActive,
          };
        }
      },
    });
  }

  saveAlert(businessId: string) {
    const existing = this.alertsByBusiness[businessId] || {};
    this.reviewService
      .upsertPriceScoreAlert({
        businessId,
        minTrustScore:
          existing.minTrustScore !== undefined ? Number(existing.minTrustScore) : undefined,
        maxAverageSpend:
          existing.maxAverageSpend !== undefined ? Number(existing.maxAverageSpend) : undefined,
        isActive: existing.isActive ?? true,
      })
      .subscribe(() => this.loadAlerts());
  }

  updateAlertField(
    businessId: string,
    field: 'minTrustScore' | 'maxAverageSpend',
    value: any,
  ) {
    const current = this.alertsByBusiness[businessId] || {};
    this.alertsByBusiness[businessId] = {
      ...current,
      [field]: value === '' || value === null ? undefined : Number(value),
    };
  }

  removeAlert(businessId: string) {
    this.reviewService.deletePriceScoreAlert(businessId).subscribe(() => this.loadAlerts());
  }

  private loadRecommendations() {
    this.reviewService.getRecommendations(6).subscribe({
      next: (items) => (this.recommendations = items || []),
    });
  }

  getGradeColor(grade: string): string {
    const g = grade?.toUpperCase();
    if (g === 'A+' || g === 'A') return '#10b981';
    if (g === 'B') return '#3b82f6';
    if (g === 'C') return '#f59e0b';
    if (g === 'D') return '#f97316';
    return '#ef4444';
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }
}
