import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  
  /**
   * Get profile image URL with consistent handling
   */
  getProfileImageUrl(user: { avatar?: string } | null): string | null {
    if (!user) return null;
    
    // Only show avatar if user has explicitly uploaded one
    if (user.avatar && user.avatar.trim() !== '') {
      // Validate the avatar URL
      if (this.isValidImageUrl(user.avatar)) {
        return user.avatar;
      } else {
        console.warn('Invalid avatar URL:', user.avatar);
        return null;
      }
    }
    
    // Don't use localStorage fallback - only show initials by default
    return null;
  }

  /**
   * Get user initials for fallback display
   */
  getUserInitials(user: { name: string } | null): string {
    if (!user || !user.name) return 'U';
    
    const nameParts = user.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[nameParts.length - 1] || '';
    
    // Get first letter of first name and first letter of last name
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    
    // If only one name, use first two letters
    if (nameParts.length === 1 && firstName.length > 1) {
      return firstName.substring(0, 2).toUpperCase();
    }
    
    // Return initials or fallback to 'U' if no valid initials
    const initials = firstInitial + lastInitial;
    return initials || 'U';
  }

  /**
   * Check if an image URL is valid
   */
  isValidImageUrl(url: string | null): boolean {
    if (!url) return false;
    
    // Check if it's a valid URL
    try {
      new URL(url);
      return true;
    } catch {
      // Check if it's a base64 data URL
      return url.startsWith('data:image/');
    }
  }

  /**
   * Get optimized Cloudinary URL for profile images
   */
  getOptimizedProfileImageUrl(cloudinaryUrl: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    if (!cloudinaryUrl || !cloudinaryUrl.includes('cloudinary.com')) {
      return cloudinaryUrl;
    }

    const sizes = {
      small: 'w_100,h_100,c_fill,g_face',
      medium: 'w_200,h_200,c_fill,g_face',
      large: 'w_400,h_400,c_fill,g_face'
    };

    // Insert transformation parameters into Cloudinary URL
    const baseUrl = cloudinaryUrl.split('/upload/')[0];
    const publicId = cloudinaryUrl.split('/upload/')[1];
    
    return `${baseUrl}/upload/${sizes[size]}/${publicId}`;
  }
}
