import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReviewService } from '../../core/services/review.service';

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
}

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  ngOnInit() {
    this.loadBookmarks();
  }

  loadBookmarks() {
    this.isLoading = true;
    this.reviewService.getBookmarks(this.currentPage).subscribe({
      next: (res) => {
        this.bookmarks = res.bookmarks || res.data || [];
        this.totalPages = res.pagination?.totalPages || 1;
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
