import { Component, ElementRef, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { RouterModule, NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-footer',
  imports: [RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css'
})
export class Footer implements OnInit, OnDestroy {
  currentYear = new Date().getFullYear();
  footerLoaded = false;
  private routerSubscription!: Subscription;
  private footerTimer: any;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private router: Router
  ) {}

  ngOnInit() {
    // Listen for route changes to reset footer after navigation
    this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.resetFooter();
        this.scheduleFooterAppearance();
      }
    });

    // Initial footer appearance
    this.scheduleFooterAppearance();
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.footerTimer) {
      clearTimeout(this.footerTimer);
    }
  }

  private scheduleFooterAppearance() {
    // Clear any existing timer
    if (this.footerTimer) {
      clearTimeout(this.footerTimer);
    }

    // Wait for DOM to settle and animations to complete
    this.footerTimer = setTimeout(() => {
      this.showFooter();
    }, 2000); // 2 second delay to ensure content animations complete
  }

  private resetFooter() {
    const footerElement = this.elementRef.nativeElement.querySelector('footer');
    if (footerElement) {
      this.renderer.removeClass(footerElement, 'footer-loaded');
      this.footerLoaded = false;
    }
  }

  private showFooter() {
    const footerElement = this.elementRef.nativeElement.querySelector('footer');
    if (footerElement && !this.footerLoaded) {
      this.renderer.addClass(footerElement, 'footer-loaded');
      this.footerLoaded = true;
    }
  }
}
