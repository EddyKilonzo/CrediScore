import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BusinessService, Business } from '../core/services/business.service';

interface Review {
  id: string;
  rating: number;
  isActive: boolean;
}

interface TrustScore {
  id: string;
  grade: string;
  score: number;
  businessId: string;
}

// Use Omit to exclude trustScore from Business and add our own version
interface BusinessWithRating extends Omit<Business, 'trustScore'> {
  averageRating?: number;
  totalReviews?: number;
  trustScore?: TrustScore | number;
  reviews?: Review[];
  latitude?: number;
  longitude?: number;
  responseRate?: number;
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent implements OnInit, OnDestroy {
  private businessService = inject(BusinessService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  searchQuery: string = '';
  allBusinesses: BusinessWithRating[] = []; // All loaded businesses
  businesses: BusinessWithRating[] = []; // Currently displayed businesses (after search)
  filteredBusinesses: BusinessWithRating[] = []; // Final filtered results
  isLoading: boolean = false;
  error: string | null = null;

  // Auto-complete
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  autocompleteResults: BusinessWithRating[] = [];
  showAutocomplete = false;

  // Filter states
  selectedStars: number | null = null;
  selectedGrade: string | null = null;
  selectedCategory: string | null = null;
  verifiedOnly: boolean = false;
  sortBy: 'trust' | 'rating' | 'reviews' | 'name' = 'trust';
  showFilters: boolean = true; // Show filters by default on desktop
  viewMode: 'list' | 'map' = 'list'; // View mode toggle

  // Available filter options
  starOptions = [5, 4, 3, 2, 1];
  gradeOptions = ['A+', 'A', 'B', 'C', 'D', 'F'];
  availableCategories: string[] = [];

  ngOnInit() {
    // Load all businesses first
    this.loadAllBusinesses();

    // Get search query from route params
    this.route.queryParams.subscribe(params => {
      this.searchQuery = params['q'] || '';
      // Apply search filter on loaded businesses
      this.applySearchAndFilters();
    });

    // Auto-complete with debounce
    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.trim().length >= 2) {
        const q = query.toLowerCase();
        this.autocompleteResults = this.allBusinesses
          .filter(b => b.name.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q))
          .slice(0, 6);
        this.showAutocomplete = this.autocompleteResults.length > 0;
      } else {
        this.autocompleteResults = [];
        this.showAutocomplete = false;
      }
    });
  }

  ngOnDestroy() {
    this.searchSub?.unsubscribe();
  }

  onSearchInput() {
    this.searchSubject.next(this.searchQuery);
    this.applySearchAndFilters();
  }

  selectAutocomplete(business: BusinessWithRating) {
    this.showAutocomplete = false;
    this.router.navigate(['/business', business.id]);
  }

  hideAutocomplete() {
    setTimeout(() => { this.showAutocomplete = false; }, 200);
  }

  performSearch() {
    // Update search query and apply filters
    this.applySearchAndFilters();
  }

  loadAllBusinesses() {
    this.isLoading = true;
    this.error = null;

    this.businessService.searchBusinesses('').subscribe({
      next: (businesses) => {
        this.allBusinesses = this.enrichBusinesses(businesses || []);
        this.extractCategories();
        this.applySearchAndFilters();
        this.isLoading = false;
      },
      error: () => {
        this.allBusinesses = [];
        this.filteredBusinesses = [];
        this.isLoading = false;
      }
    });
  }

  enrichBusinesses(businesses: Business[]): BusinessWithRating[] {
    return businesses.map((business): BusinessWithRating => {
      // Calculate average rating from reviews if available
      let averageRating = 0;
      let totalReviews = 0;

      const businessWithRating = business as unknown as BusinessWithRating & { _count?: { reviews?: number } };

      // Prefer API-returned averageRating (pre-calculated by backend aggregation)
      if (typeof businessWithRating.averageRating === 'number' && businessWithRating.averageRating > 0) {
        averageRating = Math.round(businessWithRating.averageRating * 10) / 10;
      } else if (businessWithRating.reviews && Array.isArray(businessWithRating.reviews) && businessWithRating.reviews.length > 0) {
        const activeReviews = businessWithRating.reviews.filter((r: Review) => r.isActive);
        if (activeReviews.length > 0) {
          const sum = activeReviews.reduce((acc: number, review: Review) => acc + review.rating, 0);
          averageRating = Math.round((sum / activeReviews.length) * 10) / 10;
        }
      }

      // Prefer _count.reviews from Prisma, then reviews array length
      totalReviews = businessWithRating._count?.reviews
        ?? businessWithRating.reviews?.filter((r: Review) => r.isActive).length
        ?? 0;

      // Handle trustScore - it might be a number in core service or an object
      let trustScore: TrustScore | number | undefined;
      if (typeof business.trustScore === 'number') {
        // Keep as number for now, convert to TrustScore object when needed
        trustScore = business.trustScore;
      } else if (businessWithRating.trustScore) {
        trustScore = businessWithRating.trustScore;
      } else {
        trustScore = undefined;
      }

      // Create new object with all properties
      const { trustScore: _, ...businessWithoutTrustScore } = business;
      
      // Convert trustScore number to TrustScore object if needed
      let finalTrustScore: TrustScore | number | undefined = trustScore;
      if (typeof trustScore === 'number' && !businessWithRating.trustScore) {
        finalTrustScore = {
          id: '',
          grade: this.getGradeFromScore(trustScore),
          score: trustScore,
          businessId: business.id
        };
      }
      
      return {
        ...businessWithoutTrustScore,
        isVerified: business.isVerified, // Explicitly preserve isVerified
        averageRating,
        totalReviews,
        trustScore: finalTrustScore || business.trustScore
      } as BusinessWithRating;
    });
  }

  applySearchAndFilters() {
    // Start with all businesses
    let filtered = [...this.allBusinesses];

    // Apply search query filter
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(business => {
        // Search in name, description, category, location
        const nameMatch = business.name?.toLowerCase().includes(query);
        const descMatch = business.description?.toLowerCase().includes(query);
        const categoryMatch = business.category?.toLowerCase().includes(query);
        const locationMatch = business.location?.toLowerCase().includes(query);
        const phoneMatch = business.phone?.includes(query);
        
        return nameMatch || descMatch || categoryMatch || locationMatch || phoneMatch;
      });
    }

    // Store search-filtered results
    this.businesses = filtered;

    // Apply star rating filter
    if (this.selectedStars !== null) {
      filtered = filtered.filter(business => {
        const rating = business.averageRating || 0;
        return Math.floor(rating) === this.selectedStars;
      });
    }

    // Apply grade filter
    if (this.selectedGrade) {
      filtered = filtered.filter(business => {
        if (!business.trustScore) return false;
        const grade = this.getBusinessGrade(business);
        return grade.toUpperCase() === this.selectedGrade?.toUpperCase();
      });
    }

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(b => b.category?.toLowerCase() === this.selectedCategory?.toLowerCase());
    }

    // Apply verified-only filter
    if (this.verifiedOnly) {
      filtered = filtered.filter(b => b.isVerified);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'trust':
          return this.getBusinessScore(b) - this.getBusinessScore(a);
        case 'rating':
          return (b.averageRating || 0) - (a.averageRating || 0);
        case 'reviews':
          return (b.totalReviews || 0) - (a.totalReviews || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    this.filteredBusinesses = filtered;
  }

  extractCategories() {
    const cats = new Set<string>();
    this.allBusinesses.forEach(b => { if (b.category) cats.add(b.category); });
    this.availableCategories = Array.from(cats).sort();
  }

  onCategoryFilterChange(category: string | null) {
    this.selectedCategory = this.selectedCategory === category ? null : category;
    this.applySearchAndFilters();
  }

  onVerifiedToggle() {
    this.verifiedOnly = !this.verifiedOnly;
    this.applySearchAndFilters();
  }

  onSortChange(sort: 'trust' | 'rating' | 'reviews' | 'name') {
    this.sortBy = sort;
    this.applySearchAndFilters();
  }

  applyFilters() {
    // This method is now just an alias for applySearchAndFilters
    this.applySearchAndFilters();
  }

  getGradeFromScore(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  onStarFilterChange(stars: number | null) {
    this.selectedStars = this.selectedStars === stars ? null : stars;
    this.applySearchAndFilters();
  }

  onGradeFilterChange(grade: string | null) {
    this.selectedGrade = this.selectedGrade === grade ? null : grade;
    this.applySearchAndFilters();
  }

  clearFilters() {
    this.selectedStars = null;
    this.selectedGrade = null;
    this.selectedCategory = null;
    this.verifiedOnly = false;
    this.sortBy = 'trust';
    this.applySearchAndFilters();
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  getStarsArray(rating: number): number[] {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return Array(5).fill(0).map((_, i) => {
      if (i < fullStars) return 1;
      if (i === fullStars && hasHalfStar) return 0.5;
      return 0;
    });
  }

  getStarClass(starIndex: number, rating: number): 'filled' | 'half' | 'empty' {
    const floorRating = Math.floor(rating);
    const ceilRating = Math.ceil(rating);
    const hasHalf = rating % 1 >= 0.5;

    if (starIndex <= floorRating) {
      return 'filled';
    }
    if (starIndex === ceilRating && hasHalf) {
      return 'half';
    }
    return 'empty';
  }

  getGradeColor(grade: string): string {
    const gradeUpper = grade.toUpperCase();
    if (gradeUpper === 'A+' || gradeUpper === 'A') return '#10b981'; // Green
    if (gradeUpper === 'B') return '#3b82f6'; // Blue
    if (gradeUpper === 'C') return '#f59e0b'; // Yellow
    if (gradeUpper === 'D') return '#f97316'; // Orange
    return '#ef4444'; // Red for F
  }

  getBusinessGrade(business: BusinessWithRating): string {
    if (typeof business.trustScore === 'object' && business.trustScore?.grade) {
      return business.trustScore.grade.toUpperCase();
    }
    if (typeof business.trustScore === 'object' && business.trustScore?.score !== undefined) {
      return this.getGradeFromScore(business.trustScore.score);
    }
    // Fallback to trustScore as number if it exists
    if (typeof business.trustScore === 'number') {
      return this.getGradeFromScore(business.trustScore);
    }
    return 'N/A';
  }

  getBusinessScore(business: BusinessWithRating): number {
    if (typeof business.trustScore === 'object' && business.trustScore?.score !== undefined) {
      return business.trustScore.score;
    }
    // Fallback to trustScore as number if it exists
    if (typeof business.trustScore === 'number') {
      return business.trustScore;
    }
    return 0;
  }

  onSearch() {
    // Update URL with search query
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    } else {
      this.router.navigate(['/search']);
    }
    // Apply search and filters
    this.applySearchAndFilters();
  }

  viewBusiness(businessId: string) {
    // Navigate to business profile page
    this.router.navigate(['/business', businessId]);
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'list' ? 'map' : 'list';
  }

  getBusinessesWithLocation(): BusinessWithRating[] {
    return this.filteredBusinesses.filter(business => 
      (business.latitude && business.longitude) || business.location
    );
  }

  getMapUrl(): string {
    const businessesWithLocation = this.getBusinessesWithLocation();
    if (businessesWithLocation.length === 0) {
      return '';
    }

    // If we have businesses with coordinates, create a map with markers
    const businessesWithCoords = businessesWithLocation.filter(b => b.latitude && b.longitude);
    
    if (businessesWithCoords.length > 0) {
      // Use the first business as center, or calculate center point
      const centerLat = businessesWithCoords[0].latitude!;
      const centerLng = businessesWithCoords[0].longitude!;
      
      // Create markers for all businesses
      const markers = businessesWithCoords.map(b => 
        `${b.latitude},${b.longitude}`
      ).join('|');
      
      return `https://www.google.com/maps?q=${centerLat},${centerLng}&hl=en&z=12&output=embed`;
    }

    // Fallback: use first business location as text
    if (businessesWithLocation[0].location) {
      const location = encodeURIComponent(businessesWithLocation[0].location);
      return `https://www.google.com/maps?q=${location}&hl=en&z=12&output=embed`;
    }

    return '';
  }

  getBusinessMapUrl(business: BusinessWithRating): string {
    if (business.latitude && business.longitude) {
      return `https://www.google.com/maps?q=${business.latitude},${business.longitude}&hl=en&z=15&output=embed`;
    }
    if (business.location) {
      const location = encodeURIComponent(business.location);
      return `https://www.google.com/maps?q=${location}&hl=en&z=15&output=embed`;
    }
    return '';
  }

  getGoogleMapsDirectionsUrl(business: BusinessWithRating): string {
    if (business.latitude && business.longitude) {
      return `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`;
    }
    if (business.location) {
      const location = encodeURIComponent(business.location);
      return `https://www.google.com/maps/dir/?api=1&destination=${location}`;
    }
    return 'https://www.google.com/maps';
  }

  sanitizeMapUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}

