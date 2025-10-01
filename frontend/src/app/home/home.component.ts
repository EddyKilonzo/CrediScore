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
          if (entry.isIntersecting) {
            // Add visible class when element enters viewport
            entry.target.classList.add('visible');
            // Unobserve element after it becomes visible to prevent re-triggering
            fadeObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.01, // Trigger when just 1% of element is visible (more forgiving)
        rootMargin: '50px 0px 0px 0px' // Start animation slightly before element enters viewport
      }
    );

    // Observe all elements with animation classes
    const animatedElements = document.querySelectorAll(
      '.fade-in-up, .fade-in-up-delay-1, .fade-in-up-delay-2, .fade-in-up-delay-3, ' +
      '.fade-in-up-delay-4, .fade-in-up-delay-5, .fade-in-up-delay-6, ' +
      '.fade-in-up-fast, .fade-in-up-slow, .fade-scale, ' +
      '.slide-in-left, .slide-in-right'
    );

    // Immediately show elements that are already in viewport
    animatedElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
      
      if (isInViewport && rect.top < window.innerHeight * 0.9) {
        // Element is already in viewport, show it immediately and don't observe
        element.classList.add('visible');
      } else {
        // Element is below viewport, observe it for scroll animation
        fadeObserver.observe(element);
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
}
