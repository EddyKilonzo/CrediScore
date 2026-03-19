import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface CategoryBusiness {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  category?: string;
  isVerified: boolean;
  location?: string;
  trustScore?: { grade: string; score: number };
  _count?: { reviews: number };
}

@Component({
  selector: 'app-category-browse',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './category-browse.component.html',
  styleUrl: './category-browse.component.css'
})
export class CategoryBrowseComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);

  categoryName = '';
  businesses: CategoryBusiness[] = [];
  isLoading = true;
  error: string | null = null;
  page = 1;
  totalPages = 1;
  total = 0;
  readonly limit = 12;

  private readonly API = 'http://localhost:3000/api';

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.categoryName = params.get('name') || '';
      this.page = 1;
      this.loadBusinesses();
    });
  }

  loadBusinesses() {
    this.isLoading = true;
    this.error = null;
    // Use public search endpoint with category filter
    this.http.get<any>(`${this.API}/public/business/search`, {
      params: { category: this.categoryName, page: this.page, limit: this.limit }
    }).subscribe({
      next: (res) => {
        this.businesses = res.businesses || [];
        this.total = res.pagination?.total || 0;
        this.totalPages = res.pagination?.totalPages || 1;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load businesses. Please try again.';
        this.isLoading = false;
      }
    });
  }

  prevPage() {
    if (this.page > 1) { this.page--; this.loadBusinesses(); }
  }

  nextPage() {
    if (this.page < this.totalPages) { this.page++; this.loadBusinesses(); }
  }

  getGradeColor(grade: string): string {
    if (!grade) return '#6b7280';
    if (grade.startsWith('A')) return '#059669';
    if (grade.startsWith('B')) return '#2563eb';
    if (grade.startsWith('C')) return '#d97706';
    if (grade.startsWith('D')) return '#dc2626';
    return '#6b7280';
  }

  getInitials(name: string): string {
    return (name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  goBack() {
    this.router.navigate(['/search']);
  }
}
