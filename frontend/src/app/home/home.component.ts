import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChildren, QueryList, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../core/services/auth.service';
import { ToastService } from '../shared/components/toast/toast.service';

interface Statistic {
  iconClass: string;
  count: number;
  displayCount: number;
  suffix: string;
  label: string;
  description: string;
  growth: string;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChildren('statCard') statCards!: QueryList<ElementRef>;

  // Inject services
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  // Authentication state
  currentUser = this.authService.currentUser;
  isAuthenticated = this.authService.isAuthenticated;

  searchQuery: string = '';
  searchCategory: string = 'all';
  isDropdownOpen: boolean = false;
  parallaxOffset: number = 0;
  faqOpen: boolean[] = [false, false, false, false, false, false];
  private hasAnimated = false;
  showBackToTop = false;
  
  // Testimonial slider properties
  currentTestimonialIndex = 0;
  isSliderPaused = false;
  private sliderInterval: any;
  totalTestimonials = 6; // Actual number of unique testimonials

  statistics: Statistic[] = [
    {
      iconClass: 'uil uil-building',
      count: 3247,
      displayCount: 0,
      suffix: '',
      label: 'Verified Businesses',
      description: 'Active verified businesses',
      growth: '+18%',
      color: 'from-primary to-primary-600'
    },
    {
      iconClass: 'uil uil-chat-bubble-user',
      count: 12856,
      displayCount: 0,
      suffix: '',
      label: 'Authentic Reviews',
      description: 'AI-verified reviews posted',
      growth: '+24%',
      color: 'from-primary to-primary-600'
    },
    {
      iconClass: 'uil uil-users-alt',
      count: 8943,
      displayCount: 0,
      suffix: '+',
      label: 'Active Users',
      description: 'Registered platform users',
      growth: '+32%',
      color: 'from-primary to-primary-600'
    },
    {
      iconClass: 'uil uil-shield-check',
      count: 96.8,
      displayCount: 0,
      suffix: '%',
      label: 'Trust Score',
      description: 'Average platform reliability',
      growth: '+3.2%',
      color: 'from-primary to-primary-600'
    }
  ];

  categories = [
    { value: 'all', label: 'All Businesses' },
    { value: 'retail', label: 'Retail' },
    { value: 'finance', label: 'Finance' },
    { value: 'technology', label: 'Technology' },
    { value: 'hospitality', label: 'Hospitality' }
  ];

  popularSearches = [
    'Mama Mboga Shop',
    'Jua Kali Garage',
    'Beauty Salon',
    'M-Pesa Agent',
    'Hardware Store'
  ];

  ngOnInit() {
    // Initialize display counts
    this.statistics.forEach(stat => stat.displayCount = 0);
    
    // Start testimonial slider
    this.startTestimonialSlider();
  }
  
  ngOnDestroy() {
    // Clean up slider interval
    if (this.sliderInterval) {
      clearInterval(this.sliderInterval);
    }
  }

  ngAfterViewInit() {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      this.initScrollAnimations();
    }, 100);

    // Set up intersection observer for counter animation
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.hasAnimated) {
            this.hasAnimated = true;
            this.animateCounters();
          }
        });
      },
      { threshold: 0.3 }
    );

    // Observe the first stat card to trigger animation
    if (this.statCards.first) {
      observer.observe(this.statCards.first.nativeElement);
    }
  }

  initScrollAnimations() {
    // Create intersection observer for fade-in animations
    const fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting && !el.dataset['animated']) {
            // Add animated class and mark as animated
            el.classList.add('animated');
            el.dataset['animated'] = 'true';
            // Unobserve element after animation to prevent re-triggering
            fadeObserver.unobserve(el);
          }
        });
      },
      {
        threshold: 0.2, // Trigger when 20% of element is visible
        rootMargin: '50px 0px 50px 0px' // Start animation slightly before element enters viewport
      }
    );

    // Observe all elements with animation classes
    const animatedElements = document.querySelectorAll(
      '.fade-in-up, .fade-in-up-delay-1, .fade-in-up-delay-2, .fade-in-up-delay-3, ' +
      '.fade-in-up-delay-4, .fade-in-up-delay-5, .fade-in-up-delay-6, ' +
      '.stat-card, .business-card, .faq-item'
    );

    // Check initial state and observe all elements
    animatedElements.forEach(element => {
      const el = element as HTMLElement;
      // If already animated, keep visible
      if (el.dataset['animated'] === 'true') {
        el.classList.add('animated');
        return;
      }
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
      if (isInViewport && rect.top < window.innerHeight * 0.7) {
        // Element is already in viewport, animate it immediately and mark as animated
        setTimeout(() => {
          el.classList.add('animated');
          el.dataset['animated'] = 'true';
        }, 200);
      } else {
        // Element is below viewport, observe it for scroll animation
        fadeObserver.observe(el);
      }
    });
  }

  animateCounters() {
    this.statistics.forEach((stat, index) => {
      const duration = 3500; // 3.5 seconds - slower for better UI
      const steps = 70; // More steps for smoother animation
      const increment = stat.count / steps;
      let currentStep = 0;

      const interval = setInterval(() => {
        currentStep++;
        if (currentStep <= steps) {
          stat.displayCount = Math.min(
            Math.round(increment * currentStep * 100) / 100,
            stat.count
          );
        } else {
          stat.displayCount = stat.count;
          clearInterval(interval);
        }
      }, duration / steps);
    });
  }

  formatNumber(num: number): string {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: num % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: num % 1 !== 0 ? 1 : 0
    });
  }

  get selectedCategoryLabel(): string {
    return this.categories.find(c => c.value === this.searchCategory)?.label || 'All Businesses';
  }

  @HostListener('window:scroll')
  onScroll() {
    requestAnimationFrame(() => {
      this.parallaxOffset = window.pageYOffset * 0.6;
      
      // Show/hide back to top button
      const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      
      // Show button when user has scrolled past 2x viewport height
      this.showBackToTop = scrollPosition > (windowHeight * 2);
    });
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectCategory(value: string) {
    this.searchCategory = value;
    this.isDropdownOpen = false;
  }

  onSearch() {
    console.log('Searching for:', this.searchQuery, 'in category:', this.searchCategory);
  }

  searchPopular(term: string) {
    this.searchQuery = term;
    this.onSearch();
  }

  toggleFaq(index: number) {
    this.faqOpen[index] = !this.faqOpen[index];
  }
  
  // Testimonial Slider Methods
  startTestimonialSlider() {
    this.sliderInterval = setInterval(() => {
      if (!this.isSliderPaused) {
        this.nextTestimonial();
      }
    }, 3500); // Change slide every 3.5 seconds
  }
  
  nextTestimonial() {
    this.currentTestimonialIndex++;
    
    // Seamless loop: when we reach slide 6 (first duplicate), 
    // wait for animation then snap back to 0
    if (this.currentTestimonialIndex === this.totalTestimonials) {
      setTimeout(() => {
        // Temporarily remove transition for instant reset
        const sliderEl = document.querySelector('.testimonial-slider') as HTMLElement;
        if (sliderEl) {
          sliderEl.style.transition = 'none';
          this.currentTestimonialIndex = 0;
          
          // Re-enable transition after a brief moment
          setTimeout(() => {
            if (sliderEl) {
              sliderEl.style.transition = 'transform 0.7s ease-out';
            }
          }, 50);
        }
      }, 700); // Wait for slide animation to complete
    }
  }
  
  previousTestimonial() {
    if (this.currentTestimonialIndex === 0) {
      this.currentTestimonialIndex = this.totalTestimonials - 1;
    } else {
      this.currentTestimonialIndex--;
    }
  }
  
  goToTestimonial(index: number) {
    this.currentTestimonialIndex = index;
  }
  
  pauseSlider() {
    this.isSliderPaused = true;
  }
  
  resumeSlider() {
    this.isSliderPaused = false;
  }

  // Back to top functionality
  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // Profile-related methods
  getUserInitials(user: User): string {
    if (!user || !user.name) return '';
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[1] || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  getProfileImageUrl(): string | null {
    const user = this.currentUser();
    if (user?.avatar) {
      return user.avatar;
    }
    // Fallback to localStorage for backward compatibility
    return localStorage.getItem('profileImage');
  }

  logout() {
    const userName = this.currentUser()?.name || 'User';
    this.authService.logout();
    this.toastService.info(`Goodbye, ${userName}! You have been logged out successfully.`);
  }
}
