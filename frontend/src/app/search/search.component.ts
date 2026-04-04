import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BusinessService, Business } from '../core/services/business.service';
import { BusinessMapViewComponent } from '../shared/components/business-map-view/business-map-view.component';

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
  businessHours?: any[];
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BusinessMapViewComponent],
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

      // Type cast for internal count and reviews
      const b = business as any;

      // Prefer API-returned averageRating (pre-calculated by backend aggregation)
      if (typeof b.averageRating === 'number' && b.averageRating > 0) {
        averageRating = Math.round(b.averageRating * 10) / 10;
      } else if (b.reviews && Array.isArray(b.reviews) && b.reviews.length > 0) {
        const activeReviews = b.reviews.filter((r: any) => r.isActive);
        if (activeReviews.length > 0) {
          const sum = activeReviews.reduce((acc: number, review: any) => acc + review.rating, 0);
          averageRating = Math.round((sum / activeReviews.length) * 10) / 10;
        }
      }

      // Prefer _count.reviews from Prisma, then reviews array length
      totalReviews = b._count?.reviews
        ?? b.reviews?.filter((r: any) => r.isActive).length
        ?? 0;

      // Handle trustScore
      let scoreNum = 0;
      let gradeStr = 'F';
      
      if (typeof business.trustScore === 'number') {
        scoreNum = business.trustScore;
        gradeStr = this.getGradeFromScore(scoreNum);
      } else if (b.trustScore && typeof b.trustScore === 'object') {
        scoreNum = b.trustScore.score || 0;
        gradeStr = b.trustScore.grade || this.getGradeFromScore(scoreNum);
      }

      const finalTrustScore: TrustScore = {
        id: b.trustScore?.id || '',
        grade: gradeStr,
        score: scoreNum,
        businessId: business.id
      };
      
      return {
        ...business, // Copy all original properties (name, description, logo, etc.)
        averageRating,
        totalReviews,
        trustScore: finalTrustScore,
        businessHours: business.businessHours || []
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
      // Use the first business as center
      const first = businessesWithCoords[0];
      return `https://www.google.com/maps?q=${first.latitude},${first.longitude}&hl=en&z=12&output=embed`;
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

  getTodayDay(): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  sanitizeMapUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  isBusinessOpen(business: BusinessWithRating): boolean {
    if (!business.businessHours || business.businessHours.length === 0) return true;
    
    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    
    // Convert current time to minutes from midnight
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const todayHours = business.businessHours.find(h => h.day.toLowerCase() === currentDay);
    if (!todayHours || todayHours.isClosed) return false;
    
    // Parse HH:mm to minutes from midnight
    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const openMinutes = parseTime(todayHours.open);
    const closeMinutes = parseTime(todayHours.close);
    
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  getSocialLinksArray(socialLinks: any): Array<{ icon: string; url: string; color: string }> {
    if (!socialLinks) return [];
    
    const links = [];
    if (socialLinks.facebook) links.push({ icon: 'uil-facebook-f', url: socialLinks.facebook, color: '#1877F2' });
    if (socialLinks.twitter) links.push({ icon: 'uil-twitter', url: socialLinks.twitter, color: '#1DA1F2' });
    if (socialLinks.instagram) links.push({ icon: 'uil-instagram', url: socialLinks.instagram, color: '#E4405F' });
    if (socialLinks.linkedin) links.push({ icon: 'uil-linkedin', url: socialLinks.linkedin, color: '#0A66C2' });
    if (socialLinks.youtube) links.push({ icon: 'uil-youtube', url: socialLinks.youtube, color: '#FF0000' });
    if (socialLinks.tiktok) links.push({ icon: 'uil-music', url: socialLinks.tiktok, color: '#000000' });
    
    return links;
  }
}
