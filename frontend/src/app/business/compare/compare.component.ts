import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BusinessService, BusinessComparisonRow } from '../../core/services/business.service';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.css',
})
export class CompareComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private businessService = inject(BusinessService);

  loading = false;
  error: string | null = null;
  rows: BusinessComparisonRow[] = [];

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const ids = (params.get('ids') || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      if (ids.length < 2) {
        this.error = 'Select at least two businesses to compare.';
        this.rows = [];
        return;
      }
      this.fetch(ids);
    });
  }

  private fetch(ids: string[]): void {
    this.loading = true;
    this.error = null;
    this.businessService.getBusinessComparison(ids).subscribe({
      next: (res) => {
        this.rows = res.businesses || [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load comparison data.';
        this.loading = false;
      },
    });
  }
}
