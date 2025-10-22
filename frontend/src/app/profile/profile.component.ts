import { Component, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, User } from '../core/services/auth.service';
import { ToastService } from '../shared/components/toast/toast.service';
import { CloudinaryService } from '../core/services/cloudinary.service';
import { ImageService } from '../shared/services/image.service';

interface Tab {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

interface Business {
  name: string;
  status: string;
  rating: number;
  category: string;
  trustScore: number;
}

interface Activity {
  action: string;
  date: string;
  time: string;
  business: string;
}

interface MockData {
  businesses: Business[];
  recentActivity: Activity[];
  trustScore: number;
  reputation: number;
  reviewsCount: number;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  // Mock data for display
  mockData: MockData = {
    businesses: [
      { name: 'Sample Business 1', status: 'Verified', rating: 4.5, category: 'Restaurant', trustScore: 85 },
      { name: 'Sample Business 2', status: 'Pending', rating: 4.2, category: 'Retail', trustScore: 78 }
    ],
    recentActivity: [
      { action: 'Updated profile', date: '2024-01-15', time: '10:30 AM', business: 'Sample Business 1' },
      { action: 'Added business', date: '2024-01-14', time: '2:15 PM', business: 'Sample Business 2' }
    ],
    trustScore: 85,
    reputation: 4.3,
    reviewsCount: 12
  };

  profileForm: FormGroup;
  activeTab = signal('overview');
  isLoading = signal(false);
  currentUser = signal<User | null>(null);
  
  // Settings state
  currentTheme = signal('light');
  emailNotifications = signal(true);
  pushNotifications = signal(true);
  reviewReminders = signal(true);
  publicProfile = signal(true);
  selectedLanguage = signal('en');

  // Available tabs
  allTabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: 'fas fa-chart-pie', active: true },
    { id: 'business', label: 'Business', icon: 'fas fa-building', active: false },
    { id: 'reviews', label: 'Reviews', icon: 'fas fa-star', active: false },
    { id: 'trust', label: 'Trust Score', icon: 'fas fa-shield-alt', active: false },
    { id: 'settings', label: 'Settings', icon: 'fas fa-cog', active: false }
  ];

  // Computed property for visible tabs based on user role
  visibleTabs = computed(() => {
    const user = this.currentUser();
    if (!user) return this.allTabs.filter(tab => tab.id === 'overview');

    return this.allTabs.filter(tab => {
      if (tab.id === 'business') {
        return user.role === 'business' || user.role === 'admin';
      }
      return true;
    });
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private cloudinaryService: CloudinaryService,
    public imageService: ImageService
  ) {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }],
      phone: ['', [Validators.pattern(/^[\+]?[1-9][\d]{0,15}$/)]],
      bio: ['', [Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    // Get current user
    this.currentUser.set(this.authService.currentUser());
    
    // Subscribe to user changes
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
      if (user) {
        this.populateForm(user);
      }
    });

    // Initialize form with current user data
    const user = this.authService.currentUser();
    if (user) {
      this.populateForm(user);
    }

    // Load settings from localStorage
    this.loadSettings();
  }

  private populateForm(user: User): void {
    const nameParts = user.name.split(' ');
    this.profileForm.patchValue({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: user.email,
      phone: user.phone || '',
      bio: user.bio || ''
    });
  }

  private loadSettings(): void {
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    this.currentTheme.set(savedTheme);
    
    // Load notification settings
    this.emailNotifications.set(
      localStorage.getItem('emailNotifications') !== 'false'
    );
    this.pushNotifications.set(
      localStorage.getItem('pushNotifications') !== 'false'
    );
    this.reviewReminders.set(
      localStorage.getItem('reviewReminders') !== 'false'
    );
    this.publicProfile.set(
      localStorage.getItem('publicProfile') !== 'false'
    );
    
    // Load language
    const savedLanguage = localStorage.getItem('language') || 'en';
    this.selectedLanguage.set(savedLanguage);
  }

  getVisibleTabs(): Tab[] {
    return this.visibleTabs();
  }

  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
    
    // Update tab active states
    this.allTabs.forEach(tab => {
      tab.active = tab.id === tabId;
    });
  }

  getProfileImageUrl(): string | null {
    return this.imageService.getProfileImageUrl(this.currentUser());
  }

  getUserInitials(user: User): string {
    return this.imageService.getUserInitials(user);
  }

  getUserAddress(): string {
    // Mock address - in real app, this would come from user data
    return '123 Main Street, Nairobi';
  }

  getUserCity(): string {
    // Mock city - in real app, this would come from user data
    return 'Nairobi, Kenya';
  }

  getUserPostalCode(): string {
    // Mock postal code - in real app, this would come from user data
    return '00100';
  }

  getJoinDate(): string {
    const user = this.currentUser();
    if (!user) return 'Unknown';
    
    // Mock join date - in real app, this would come from user data
    return 'January 2024';
  }

  triggerFileUpload(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      console.log('File selected:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
      
      // Validate file
      const validation = this.cloudinaryService.validateFile(file);
      if (!validation.isValid) {
        console.error('File validation failed:', validation.error);
        this.toastService.error(validation.error || 'Invalid file');
        return;
      }
      
      console.log('File validation passed');
      
      // Show loading state
      this.isLoading.set(true);
      this.toastService.success('Uploading image...');
      
      // Create upload options for profile images
      const user = this.currentUser();
      console.log('Current user:', user);
      const options = this.cloudinaryService.createProfileImageOptions(user?.id);
      console.log('Upload options:', options);
      
      // Upload to Cloudinary
      this.cloudinaryService.uploadFile(file, options).subscribe({
        next: (response) => {
          if (response.success) {
            // Update user profile with new avatar URL
            const updateData = {
              avatar: response.data.url
            };
            
            this.authService.updateProfile(updateData).subscribe({
              next: (updatedUser) => {
                this.isLoading.set(false);
                this.authService.updateUserData(updatedUser);
                this.toastService.success('Profile picture updated successfully!');
                
                // Clear the file input
                if (input) {
                  input.value = '';
                }
              },
              error: (error) => {
                this.isLoading.set(false);
                this.toastService.error('Failed to update profile. Please try again.');
                console.error('Profile update error:', error);
              }
            });
          } else {
            this.isLoading.set(false);
            this.toastService.error('Upload failed. Please try again.');
          }
        },
        error: (error) => {
          this.isLoading.set(false);
          let errorMessage = 'Upload failed. Please try again.';
          
          console.error('=== UPLOAD ERROR ===');
          console.error('Full error object:', error);
          console.error('Error status:', error.status);
          console.error('Error statusText:', error.statusText);
          console.error('Error message:', error.message);
          console.error('Error error:', error.error);
          console.error('Error url:', error.url);
          console.error('Error headers:', error.headers);
          
          if (error.status === 400) {
            errorMessage = 'Invalid file or server configuration issue. Please check if Cloudinary is properly configured.';
            console.error('400 Bad Request - likely file format or server issue');
          } else if (error.error?.message) {
            errorMessage = error.error.message;
            console.error('Server error message:', error.error.message);
          }
          
          this.toastService.error(errorMessage);
        }
      });
    }
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.isLoading.set(true);
      
      const formValue = this.profileForm.value;
      const user = this.currentUser();
      const updateData = {
        name: `${formValue.firstName} ${formValue.lastName}`.trim(),
        phone: formValue.phone,
        bio: formValue.bio,
        // Include current avatar if no new image was uploaded
        avatar: user?.avatar
      };
      
      this.authService.updateProfile(updateData).subscribe({
        next: (updatedUser) => {
          this.isLoading.set(false);
          this.toastService.success('Profile updated successfully');
          this.authService.updateUserData(updatedUser);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.toastService.error('Failed to update profile. Please try again.');
          console.error('Profile update error:', error);
        }
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      const control = this.profileForm.get(key);
      control?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.profileForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['minlength']) {
        return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['maxlength']) {
        return `${fieldName} must be less than ${field.errors['maxlength'].requiredLength} characters`;
      }
      if (field.errors['pattern']) {
        return `Please enter a valid ${fieldName}`;
      }
    }
    return '';
  }

  // Settings methods
  setTheme(theme: string): void {
    this.currentTheme.set(theme);
    localStorage.setItem('theme', theme);
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    
    this.toastService.success(`Theme changed to ${theme}`);
  }

  toggleEmailNotifications(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.emailNotifications.set(checked);
    localStorage.setItem('emailNotifications', checked.toString());
    this.toastService.success(`Email notifications ${checked ? 'enabled' : 'disabled'}`);
  }

  togglePushNotifications(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.pushNotifications.set(checked);
    localStorage.setItem('pushNotifications', checked.toString());
    this.toastService.success(`Push notifications ${checked ? 'enabled' : 'disabled'}`);
  }

  toggleReviewReminders(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.reviewReminders.set(checked);
    localStorage.setItem('reviewReminders', checked.toString());
    this.toastService.success(`Review reminders ${checked ? 'enabled' : 'disabled'}`);
  }

  togglePublicProfile(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.publicProfile.set(checked);
    localStorage.setItem('publicProfile', checked.toString());
    this.toastService.success(`Public profile ${checked ? 'enabled' : 'disabled'}`);
  }

  onLanguageChange(event: Event): void {
    const language = (event.target as HTMLSelectElement).value;
    this.selectedLanguage.set(language);
    localStorage.setItem('language', language);
    this.toastService.success(`Language changed to ${language}`);
  }
}