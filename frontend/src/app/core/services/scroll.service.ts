import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  
  /**
   * Scroll to the top of the page
   */
  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }

  /**
   * Scroll to the top of the page instantly (without smooth animation)
   */
  scrollToTopInstant(): void {
    window.scrollTo(0, 0);
  }

  /**
   * Scroll to a specific element by ID
   */
  scrollToElement(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  /**
   * Scroll to a specific position
   */
  scrollToPosition(x: number, y: number, smooth: boolean = true): void {
    window.scrollTo({
      top: y,
      left: x,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
}
