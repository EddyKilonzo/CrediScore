import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-lightbox.component.html',
  styleUrl: './image-lightbox.component.css'
})
export class ImageLightboxComponent {
  @Input() images: string[] = [];
  @Input() currentIndex = 0;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  get currentImage(): string {
    return this.images[this.currentIndex] || '';
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (!this.isOpen) return;
    if (event.key === 'Escape') this.closeLightbox();
    if (event.key === 'ArrowRight') this.next();
    if (event.key === 'ArrowLeft') this.prev();
  }

  closeLightbox() {
    this.close.emit();
  }

  prev() {
    if (this.currentIndex > 0) this.currentIndex--;
    else this.currentIndex = this.images.length - 1;
  }

  next() {
    if (this.currentIndex < this.images.length - 1) this.currentIndex++;
    else this.currentIndex = 0;
  }

  goTo(index: number) {
    this.currentIndex = index;
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('lightbox-backdrop')) {
      this.closeLightbox();
    }
  }
}
