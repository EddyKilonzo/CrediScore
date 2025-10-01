import { Component, signal } from '@angular/core';
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

  constructor(private router: Router) {
    // Hide navbar on landing page, show on all other pages
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showNavbar = event.url !== '/' && event.url !== '/home';
    });
  }
}