import { Component, HostListener, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { Footer } from './shared/components/footer/footer';
import { ToastComponent } from './shared/components/toast/toast.component';
import { isLoading } from './core/services/loading.interceptor';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, ToastComponent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('CrediScore');
  protected readonly isLoading = isLoading();
  showNavbar = true;
  showFooter = true;
  showBackToTop = false;

  constructor(private router: Router) {
    this.applyChromeFromUrl(this.router.url);
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.applyChromeFromUrl(event.urlAfterRedirects);
    });
  }

  private applyChromeFromUrl(url: string): void {
    const path = url.split('?')[0];
    this.showNavbar = path !== '/' && path !== '/home';
    this.showFooter = !path.startsWith('/auth');
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    this.showBackToTop = scrollTop > 400;
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}