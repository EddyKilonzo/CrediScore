import { Component, HostListener, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

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

  searchQuery: string = '';
  searchCategory: string = 'all';
  isDropdownOpen: boolean = false;
  parallaxOffset: number = 0;
  faqOpen: boolean[] = [false, false, false, false, false, false];
  private hasAnimated = false;
  showBackToTop = false;
  private fadeObserver?: IntersectionObserver;
  
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
    
    // Clean up intersection observer
    if (this.fadeObserver) {
      this.fadeObserver.disconnect();
      this.fadeObserver = undefined;
    }
  }

  ngAfterViewInit() {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      this.initScrollAnimations();
      // Force immediate animation for critical elements
      this.forceAnimationOnVisible();
      
      // Re-run animation initialization if elements were added
      setTimeout(() => {
        this.recheckAnimatedElements();
        // Additional check for any missed elements
        setTimeout(() => {
          this.initializeVisibleElements();
        }, 300);
      }, 500);
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
    // Clean up any existing observer
    if (this.fadeObserver) {
      this.fadeObserver.disconnect();
    }

    // Persistent state tracking to prevent re-animation issues
    const animationStates = new Map<string, boolean>();

    // Create intersection observer for fade-in animations
    this.fadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        // Create a unique identifier for this element
        const elementId = el.className + el.id || Math.random().toString(36);
        
        // Only animate if not already animated
        if (entry.isIntersecting && !animationStates.get(elementId) && !el.dataset['animated']) {
          // Add animated class and mark as animated permanently
          el.classList.add('animated');
          el.dataset['animated'] = 'true';
          animationStates.set(elementId, true);
          
          // DO NOT unobserve to prevent future visibility issues
          // fadeObserver.unobserve(el);
        } else if (!entry.isIntersecting && animationStates.get(elementId)) {
          // If element goes out of view but was animated, ensure it stays visible
          el.classList.add('animated');
          el.dataset['animated'] = 'true';
        }
      });
    },
    {
      threshold: 0.2, // Trigger when 20% of element is visible
      rootMargin: '50px 0px 50px 0px' // Start animation slightly before element enters viewport
    });

    // Observe all elements with animation classes
    const animatedElements = document.querySelectorAll(
      '.fade-in-up, .fade-in-up-delay-1, .fade-in-up-delay-2, .fade-in-up-delay-3, ' +
      '.fade-in-up-delay-4, .fade-in-up-delay-5, .fade-in-up-delay-6, ' +
      '.stat-card, .business-card, .faq-item'
    );

    // Check initial state and observe all elements
    animatedElements.forEach(element => {
      const el = element as HTMLElement;
      const elementId = el.className + el.id || Math.random().toString(36);
      
      // If already animated, keep visible and track state
      if (el.dataset['animated'] === 'true') {
        el.classList.add('animated');
        animationStates.set(elementId, true);
        return;
      }
      
      const rect = el.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (isInViewport && rect.top < window.innerHeight * 0.8) {
        // Element is already in viewport, animate it immediately and mark as animated
        // Use small delay to ensure smooth sequencing
        const animationDelay = el.classList.contains('fade-in-up-delay-1') ? 50 :
                             el.classList.contains('fade-in-up-delay-2') ? 100 :
                             el.classList.contains('fade-in-up-delay-3') ? 150 :
                             el.classList.contains('fade-in-up-delay-4') ? 200 :
                             el.classList.contains('fade-in-up-delay-5') ? 250 :
                             el.classList.contains('fade-in-up-delay-6') ? 300 : 0;
        
        setTimeout(() => {
          el.classList.add('animated');
          el.dataset['animated'] = 'true';
          animationStates.set(elementId, true);
        }, animationDelay);
      } else {
        // Element is below viewport, observe it for scroll animation
        this.fadeObserver!.observe(el);
      }
    });
  }

  recheckAnimatedElements() {
    // Re-check all animated elements to ensure they have the proper state
    const allAnimatedElements = document.querySelectorAll(
      '.fade-in-up, .fade-in-up-delay-1, .fade-in-up-delay-2, .fade-in-up-delay-3, ' +
      '.fade-in-up-delay-4, .fade-in-up-delay-5, .fade-in-up-delay-6, ' +
      '.stat-card, .business-card, .faq-item'
    );

    allAnimatedElements.forEach(element => {
      const el = element as HTMLElement;
      if (el.dataset['animated'] === 'true') {
        // Ensure animated class is still present
        el.classList.add('animated');
      }
    });
  }

  initializeVisibleElements() {
    // Ensure all visible elements are animated immediately
    const allAnimatedElements = document.querySelectorAll(
      '.fade-in-up, .fade-in-up-delay-1, .fade-in-up-delay-2, .fade-in-up-delay-3, ' +
      '.fade-in-up-delay-4, .fade-in-up-delay-5, .fade-in-up-delay-6, ' +
      '.stat-card, .business-card, .faq-item, .relative.group'
    );
    
    // Debug: Log elements found (commented out for production)
    // console.log('Found animated elements:', allAnimatedElements.length);
    
    const viewportHeight = window.innerHeight;
    const viewportTop = window.pageYOffset;
    
    allAnimatedElements.forEach((element, index) => {
      const el = element as HTMLElement;
      
      // Skip if already animated
      if (el.dataset['animated'] === 'true') {
        return;
      }
      
      const rect = el.getBoundingClientRect();
      const elementTop = rect.top + viewportTop;
      const elementBottom = elementTop + rect.height;
      const currentViewportTop = viewportTop;
      const currentViewportBottom = viewportTop + viewportHeight;
      
      // Check if element is in or above viewport
      const isVisible = (
        (elementTop < currentViewportBottom && elementBottom > currentViewportTop) ||
        elementTop < currentViewportTop
      );
      
      if (isVisible) {
        // Animate immediate with staggered delay for headings
        const delay = el.classList.contains('fade-in-up-delay-1') ? 100 :
                     el.classList.contains('fade-in-up-delay-2') ? 200 :
                     el.classList.contains('fade-in-up-delay-3') ? 300 :
                     el.classList.contains('fade-in-up-delay-4') ? 400 :
                     el.classList.contains('fade-in-up-delay-5') ? 500 :
                     el.classList.contains('fade-in-up-delay-6') ? 600 : 0;
        
        setTimeout(() => {
          el.classList.add('animated');
          el.dataset['animated'] = 'true';
        }, delay);
      }
    });
  }

  forceAnimationOnVisible() {
    // Force animation on all elements with delay classes
    const elements = document.querySelectorAll('.fade-in-up-delay-3');
    elements.forEach((el) => {
      const element = el as HTMLElement;
      if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
        setTimeout(() => {
          element.classList.add('animated');
          element.dataset['animated'] = 'true';
        }, 200);
      }
    });
  }

  checkVerticalElements() {
    // Quick check for any elements that might need animation during scroll
    const animatedElements = document.querySelectorAll(
      '.fade-in-up:not(.animated), .fade-in-up-delay-1:not(.animated), ' +
      '.fade-in-up-delay-2:not(.animated), .fade-in-up-delay-3:not(.animated), ' +
      '.stat-card:not(.animated), .business-card:not(.animated), .faq-item:not(.animated)'
    );

    const windowHeight = window.innerHeight;
    
    animatedElements.forEach((element) => {
      const el = element as HTMLElement;
      const rect = el.getBoundingClientRect();
      
      // Check if element is visible in viewport
      if (rect.top < windowHeight * 0.8 && rect.bottom > 0 && !el.dataset['animated']) {
        el.classList.add('animated');
        el.dataset['animated'] = 'true';
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
      
      // Trigger any visible elements that might have been missed
      this.checkVerticalElements();
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
}
