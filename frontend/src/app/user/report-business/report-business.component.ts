import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  switchMap,
} from 'rxjs/operators';
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
  /** Screenshots / PDFs / docs uploaded before submit (see maxEvidenceFiles) */
  evidenceFiles: File[] = [];
  readonly maxEvidenceFiles = 5;
  readonly maxEvidenceBytes = 10 * 1024 * 1024;
  /** Visual highlight while dragging files over the drop zone */
  evidenceDropActive = false;
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

  private evidenceFileError(file: File): string | null {
    if (file.size > this.maxEvidenceBytes) {
      return `"${file.name}" is larger than 10MB.`;
    }
    const t = file.type || '';
    const okImage = t.startsWith('image/');
    const okPdf = t === 'application/pdf';
    const okWord =
      t === 'application/msword' ||
      t ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!okImage && !okPdf && !okWord) {
      return `"${file.name}" must be an image, PDF, or Word document.`;
    }
    return null;
  }

  private addEvidenceFiles(picked: File[]): void {
    for (const file of picked) {
      if (this.evidenceFiles.length >= this.maxEvidenceFiles) {
        this.toastService.warning(
          `You can attach up to ${this.maxEvidenceFiles} files.`,
        );
        break;
      }
      const err = this.evidenceFileError(file);
      if (err) {
        this.toastService.warning(err);
        continue;
      }
      this.evidenceFiles.push(file);
    }
  }

  onEvidenceFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files ? Array.from(input.files) : [];
    input.value = '';
    this.addEvidenceFiles(picked);
  }

  onEvidenceDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.evidenceDropActive = true;
  }

  onEvidenceDragLeave(event: DragEvent): void {
    const related = event.relatedTarget as Node | null;
    const cur = event.currentTarget as HTMLElement;
    if (!related || !cur.contains(related)) {
      this.evidenceDropActive = false;
    }
  }

  onEvidenceDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.evidenceDropActive = false;
    const dt = event.dataTransfer;
    if (dt?.files?.length) {
      this.addEvidenceFiles(Array.from(dt.files));
    }
  }

  evidenceFileKindLabel(file: File): string {
    const t = file.type || '';
    if (t.startsWith('image/')) return 'IMG';
    if (t === 'application/pdf') return 'PDF';
    return 'DOC';
  }

  removeEvidenceFile(index: number): void {
    this.evidenceFiles.splice(index, 1);
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
    const manualLinks = this.parseEvidenceLinks();
    const uploadedUrls$ =
      this.evidenceFiles.length === 0
        ? of([] as string[])
        : forkJoin(
            this.evidenceFiles.map((f) =>
              this.reviewService
                .uploadFraudEvidence(f, this.businessId)
                .pipe(map((r) => r.url)),
            ),
          );

    uploadedUrls$
      .pipe(
        switchMap((uploaded) => {
          const all = [...manualLinks, ...uploaded];
          return this.reviewService.submitFraudReport({
            businessId: this.businessId,
            reason: this.reason,
            description: this.description.trim() || '',
            evidenceSummary: this.evidenceSummary.trim() || undefined,
            evidenceLinks: all.length ? all : undefined,
          });
        }),
        finalize(() => {
          this.submitting = false;
        }),
      )
      .subscribe({
        next: () => {
          this.toastService.success(
            'Report submitted. Our team will review it and take action if needed.',
          );
          this.reason = '';
          this.description = '';
          this.evidenceSummary = '';
          this.evidenceLinksRaw = '';
          this.evidenceFiles = [];
          this.router.navigate(['/search']);
        },
        error: (err) => {
          const msg =
            err?.error?.message ||
            'Could not submit your report. Please try again later.';
          this.toastService.error(msg);
        },
      });
  }
}
