import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService, User } from '../core/services/auth.service';
import { ToastService } from '../shared/components/toast/toast.service';

interface Tab {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private toastService = inject(ToastService) as ToastService;
  private fb = inject(FormBuilder);

  currentUser = this.authService.currentUser;
  isLoading = signal(false);
  profileImageUrl = signal<string | null>(null);
  activeTab = signal('overview');

  // Settings signals
  currentTheme = signal<'light' | 'dark'>('light');
  emailNotifications = signal(true);
  pushNotifications = signal(false);
  reviewReminders = signal(true);
  publicProfile = signal(true);
  selectedLanguage = signal('en');

  profileForm: FormGroup;

  tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: 'fas fa-user', active: true },
    { id: 'business', label: 'Business Info', icon: 'fas fa-building', active: false },
    { id: 'reviews', label: 'Reviews', icon: 'fas fa-star', active: false },
    { id: 'trust', label: 'Trust Score', icon: 'fas fa-shield-alt', active: false }
  ];

  getVisibleTabs(): Tab[] {
    const user = this.currentUser();
    if (user?.role === 'user') {
      // For customers, hide business-related tabs
      return this.tabs.filter(tab => tab.id !== 'business');
    }
    return this.tabs;
  }

  // Mock data for demonstration
  mockData = {
    trustScore: 87,
    reviewsCount: 24,
    businessesCount: 2,
    reputation: 4.8,
    recentActivity: [
      { action: 'Posted a review', business: 'Safaricom Limited', date: '2 days ago' },
      { action: 'Updated business profile', business: 'My Tech Solutions', date: '1 week ago' },
      { action: 'Verified document', business: 'My Tech Solutions', date: '2 weeks ago' }
    ],
    businesses: [
      { name: 'My Tech Solutions', category: 'Technology', trustScore: 92, status: 'Verified' },
      { name: 'Digital Marketing Pro', category: 'Marketing', trustScore: 78, status: 'Pending' }
    ]
  };

  constructor() {
    this.profileForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[\+]?[0-9\s\-\(\)]{7,15}$/)]],
      bio: ['', [Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadSettings();
  }

  private loadUserData(): void {
    const user = this.currentUser();
    if (user) {
      const nameParts = user.name.split(' ');
      this.profileForm.patchValue({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: user.email,
        phone: user.phone || '',
        bio: user.bio || ''
      });

      // Load profile image from database or localStorage
      if (user.avatar) {
        this.profileImageUrl.set(user.avatar);
      } else {
        const savedImage = localStorage.getItem('profileImage');
        if (savedImage) {
          this.profileImageUrl.set(savedImage);
        }
      }
    }
  }

  setActiveTab(tabId: string): void {
    this.activeTab.set(tabId);
    this.tabs.forEach(tab => {
      tab.active = tab.id === tabId;
    });
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.isLoading.set(true);

      const formData = this.profileForm.value;
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      
      // Prepare update data for API call
      const updateData: any = {
        name: fullName,
        phone: formData.phone || '',
        bio: formData.bio || ''
      };

      // Add avatar if changed
      if (this.profileImageUrl()) {
        updateData.avatar = this.profileImageUrl()!;
      }

      // Make API call to update profile
      this.authService.updateProfile(updateData).subscribe({
        next: (updatedUser) => {
          // Update auth service current user
          this.authService.updateUserData(updatedUser);
          this.isLoading.set(false);
          this.toastService.success('Profile updated successfully!');
        },
        error: (error) => {
          console.error('Error updating profile:', error);
          this.isLoading.set(false);
          this.toastService.error('Failed to update profile. Please try again.');
        }
      });
    } else {
      this.markFormGroupTouched();
      this.toastService.error('Please fill in all required fields correctly.');
    }
  }

  triggerFileUpload(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        this.toastService.error('File size must be less than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        this.profileImageUrl.set(result);
        
        // Update user data with new avatar
        const user = this.currentUser();
        if (user) {
          const updatedUser = {
            ...user,
            avatar: result
          };
          
          localStorage.setItem('profileImage', result);
          this.authService.updateUserData(updatedUser);
        }
        
        this.toastService.success('Profile picture updated successfully!');
      };
      reader.readAsDataURL(file);
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
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return `${fieldName} must be at least 2 characters long`;
      }
      if (field.errors['pattern']) {
        return 'Please enter a valid phone number';
      }
      if (field.errors['maxlength']) {
        return `${fieldName} must be less than 500 characters`;
      }
    }
    return '';
  }

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
    return localStorage.getItem('profileImage');
  }

  // Settings methods
  private loadSettings(): void {
    // Load settings from localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    const savedEmailNotifications = localStorage.getItem('emailNotifications') !== 'false';
    const savedPushNotifications = localStorage.getItem('pushNotifications') === 'true';
    const savedReviewReminders = localStorage.getItem('reviewReminders') !== 'false';
    const savedPublicProfile = localStorage.getItem('publicProfile') !== 'false';
    const savedLanguage = localStorage.getItem('language') || 'en';

    this.currentTheme.set(savedTheme);
    this.emailNotifications.set(savedEmailNotifications);
    this.pushNotifications.set(savedPushNotifications);
    this.reviewReminders.set(savedReviewReminders);
    this.publicProfile.set(savedPublicProfile);
    this.selectedLanguage.set(savedLanguage);

    // Apply theme to document
    this.applyTheme(savedTheme);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.currentTheme.set(theme);
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
    this.toastService.success(`Theme changed to ${theme} mode`);
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
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
    
    if (checked) {
      // Request notification permission
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            this.toastService.success('Push notifications enabled');
          } else {
            this.pushNotifications.set(false);
            localStorage.setItem('pushNotifications', 'false');
            this.toastService.error('Push notifications permission denied');
          }
        });
      } else {
        this.pushNotifications.set(false);
        localStorage.setItem('pushNotifications', 'false');
        this.toastService.error('Push notifications not supported in this browser');
      }
    } else {
      this.toastService.success('Push notifications disabled');
    }
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
    const selectedValue = (event.target as HTMLSelectElement).value;
    this.selectedLanguage.set(selectedValue);
    localStorage.setItem('language', selectedValue);
    this.toastService.success(`Language changed to ${selectedValue.toUpperCase()}`);
  }

  // Helper methods for displaying user data
  getUserAddress(): string {
    // For now, return a default address. In a real app, this would come from user profile
    // TODO: Add address field to User interface when backend supports it
    return '123 Business Street';
  }

  getUserCity(): string {
    // For now, return a default city. In a real app, this would come from user profile
    // TODO: Add city field to User interface when backend supports it
    return 'Nairobi, Kenya';
  }

  getUserPostalCode(): string {
    // For now, return a default postal code. In a real app, this would come from user profile
    // TODO: Add postalCode field to User interface when backend supports it
    return '00100';
  }

  getJoinDate(): string {
    // For now, return a default date. In a real app, this would come from user profile
    // TODO: Add createdAt field to User interface when backend supports it
    return 'Jan 15, 2024';
  }
}
