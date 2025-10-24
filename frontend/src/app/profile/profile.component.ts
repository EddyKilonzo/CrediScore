import { Component, signal, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, User } from '../core/services/auth.service';
import { ToastService } from '../shared/components/toast/toast.service';
import { CloudinaryService } from '../core/services/cloudinary.service';
import { ImageService } from '../shared/services/image.service';
import { ReviewReplyComponent } from '../shared/components/review-reply/review-reply.component';

interface Tab {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

interface Business {
  id: string;
  name: string;
  category: string;
  isVerified: boolean;
  trustScore: number;
  trustGrade: string;
  totalReviews: number;
  totalDocuments: number;
  totalPayments: number;
  createdAt: string;
}

interface Activity {
  id: string;
  type: 'review' | 'business' | 'fraud_report';
  action: string;
  target: string;
  date: string;
  verified?: boolean;
  credibility?: number;
  trustScore?: number;
  category?: string;
  status?: string;
}

interface RoleBasedData {
  user: any;
  stats: any;
  recentActivity: Activity[];
  roleSpecificData: any;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ReviewReplyComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  // Real data from backend
  profileData: RoleBasedData | null = null;

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
      switch (tab.id) {
        case 'business':
          return this.isBusinessOwner() || this.isAdmin();
        case 'reviews':
          return this.isCustomer() || this.isBusinessOwner();
        case 'trust':
          return true; // All roles can see trust score
        case 'settings':
          return true; // All roles can access settings
        case 'overview':
          return true; // All roles can see overview
        default:
          return true;
      }
    });
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private cloudinaryService: CloudinaryService,
    public imageService: ImageService,
    private router: Router
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

    // Load role-based profile data
    this.loadProfileData();

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

  private loadProfileData(): void {
    this.isLoading.set(true);
    this.authService.getRoleBasedProfileData().subscribe({
      next: (data) => {
        this.profileData = data;
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading profile data:', error);
        this.isLoading.set(false);
        this.toastService.error('Failed to load profile data');
      }
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
    // For now, return a placeholder - would need address fields in user model
    return 'Address not provided';
  }

  getUserCity(): string {
    // For now, return a placeholder - would need location fields in user model
    return 'Location not provided';
  }

  getUserPostalCode(): string {
    // For now, return a placeholder - would need postal code in user model
    return 'Not provided';
  }

  getJoinDate(): string {
    const user = this.currentUser();
    if (!user?.createdAt) return 'Unknown';
    
    const date = new Date(user.createdAt);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
  }

  // Role-based data getters
  getUserBusinesses(): Business[] {
    if (!this.profileData?.roleSpecificData?.businesses) return [];
    return this.profileData.roleSpecificData.businesses;
  }

  getRecentActivity(): Activity[] {
    if (!this.profileData?.recentActivity) return [];
    return this.profileData.recentActivity;
  }

  getUserStats(): any {
    if (!this.profileData?.stats) return {};
    return this.profileData.stats;
  }

  getRoleSpecificData(): any {
    if (!this.profileData?.roleSpecificData) return {};
    return this.profileData.roleSpecificData;
  }

  // Role-specific methods
  isCustomer(): boolean {
    const user = this.currentUser();
    return user?.role === 'CUSTOMER' || user?.role === 'user';
  }

  isBusinessOwner(): boolean {
    const user = this.currentUser();
    return user?.role === 'BUSINESS_OWNER' || user?.role === 'business';
  }

  isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role === 'ADMIN' || user?.role === 'admin';
  }

  getTrustScore(): number {
    if (this.isBusinessOwner()) {
      return this.getRoleSpecificData().averageTrustScore || 0;
    }
    return this.getUserStats().reputation || 0;
  }

  getAverageRating(): number {
    if (this.isCustomer()) {
      return this.getRoleSpecificData().averageRating || 0;
    }
    return 0;
  }

  getVerifiedReviewsCount(): number {
    if (this.isCustomer()) {
      return this.getRoleSpecificData().verifiedReviews || 0;
    }
    return 0;
  }

  getVerifiedBusinessesCount(): number {
    return this.getUserBusinesses().filter(b => b.isVerified).length;
  }

  getReviewActivities(): Activity[] {
    return this.getRecentActivity().filter(a => a.type === 'review');
  }

  // Navigation methods
  navigateToMyBusiness(): void {
    this.router.navigate(['/business/my-business']);
  }

  canRegisterBusiness(): boolean {
    return this.getUserBusinesses().length === 0;
  }

  // Review Reply Methods
  onReplyAdded(reply: any): void {
    // Refresh profile data to show updated replies
    this.loadProfileData();
  }

  onReplyUpdated(reply: any): void {
    // Refresh profile data to show updated replies
    this.loadProfileData();
  }

  onReplyDeleted(replyId: string): void {
    // Refresh profile data to show updated replies
    this.loadProfileData();
  }

  getReviewReplies(reviewId: string): any {
    // For now, return empty array signal - this would be populated from the backend
    // In a real implementation, you'd fetch replies for each review
    return signal([]);
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