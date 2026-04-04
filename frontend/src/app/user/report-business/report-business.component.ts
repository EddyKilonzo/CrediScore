import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { BusinessService } from '../../core/services/business.service';
import { ReviewService } from '../../core/services/review.service';
import { ToastService } from '../../shared/components/toast/toast.service';

@Component({
  selector: 'app-report-business',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './report-business.component.html',
  styleUrl: './report-business.component.css',
})
export class ReportBusinessComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private businessService = inject(BusinessService);
  private reviewService = inject(ReviewService);
  private toastService = inject(ToastService);

  businessId = '';
  businessName = '';
  loadingBusiness = false;

  businessSearch = '';
  searchResults: { id: string; name: string }[] = [];
  searching = false;
  private searchInput$ = new Subject<string>();
  private searchSub?: Subscription;

  reason = '';
  description = '';
  evidenceSummary = '';
  /** One URL per line (https://…) */
  evidenceLinksRaw = '';
  submitting = false;

  readonly reasonOptions: { value: string; label: string }[] = [
    { value: 'SCAM', label: 'Scam / fraudulent activity' },
    { value: 'MISLEADING', label: 'Misleading information or fake reviews' },
    { value: 'HARASSMENT', label: 'Harassment or abuse' },
    { value: 'ILLEGAL', label: 'Illegal goods or services' },
    { value: 'OTHER', label: 'Other (explain below)' },
  ];

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const id = (params['businessId'] || '').trim();
      if (id && id !== this.businessId) {
        this.businessId = id;
        this.loadBusinessSummary(id);
      }
    });

    this.searchSub = this.searchInput$
      .pipe(
        debounceTime(320),
        distinctUntilChanged(),
        switchMap((q) => {
          this.searching = true;
          return this.businessService.searchPublicBusinessesLite(q, 35);
        }),
      )
      .subscribe({
        next: (list) => {
          this.searching = false;
          this.searchResults = (list || []).map((b) => ({
            id: b.id,
            name: b.name || 'Business',
          }));
        },
        error: () => {
          this.searching = false;
          this.searchResults = [];
        },
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  onSearchInput(value: string): void {
    this.businessSearch = value;
    this.searchInput$.next(value);
  }

  selectBusiness(b: { id: string; name: string }): void {
    this.businessId = b.id;
    this.businessName = b.name;
    this.businessSearch = '';
    this.searchResults = [];
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { businessId: b.id },
      queryParamsHandling: 'merge',
    });
  }

  clearBusiness(): void {
    this.businessId = '';
    this.businessName = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { businessId: null },
      queryParamsHandling: 'merge',
    });
  }

  private loadBusinessSummary(id: string): void {
    this.loadingBusiness = true;
    this.http
      .get<{ name?: string }>(`${environment.apiUrl}/api/public/business/${id}`)
      .subscribe({
      next: (b) => {
        this.businessName = b?.name || 'Business';
        this.loadingBusiness = false;
      },
      error: () => {
        this.loadingBusiness = false;
        this.businessId = '';
        this.businessName = '';
        this.toastService.error('Business not found. Search or pick another listing.');
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { businessId: null },
          queryParamsHandling: 'merge',
        });
      },
    });
  }

  private parseEvidenceLinks(): string[] {
    return this.evidenceLinksRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\/.+/i.test(s));
  }

  submit(): void {
    if (!this.businessId || !this.reason) {
      this.toastService.warning('Choose a business and a reason.');
      return;
    }
    if (this.reason === 'OTHER' && !this.description.trim()) {
      this.toastService.warning('Please add a short description for “Other”.');
      return;
    }
    this.submitting = true;
    const links = this.parseEvidenceLinks();
    this.reviewService
      .submitFraudReport({
        businessId: this.businessId,
        reason: this.reason,
        description: this.description.trim() || '',
        evidenceSummary: this.evidenceSummary.trim() || undefined,
        evidenceLinks: links.length ? links : undefined,
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.toastService.success(
            'Report submitted. Our team will review it and take action if needed.',
          );
          this.reason = '';
          this.description = '';
          this.evidenceSummary = '';
          this.evidenceLinksRaw = '';
          this.router.navigate(['/search']);
        },
        error: (err) => {
          this.submitting = false;
          const msg =
            err?.error?.message ||
            'Could not submit your report. Please try again later.';
          this.toastService.error(msg);
        },
      });
  }
}
