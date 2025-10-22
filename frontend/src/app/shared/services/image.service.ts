import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  
  /**
   * Get profile image URL with consistent handling
   */
  getProfileImageUrl(user: { avatar?: string } | null): string | null {
    if (user?.avatar) {
      // Return the avatar URL directly (should be Cloudinary URL from database)
      return user.avatar;
    }
    // Return null for consistency
    return null;
  }

  /**
   * Get user initials for fallback display
   */
  getUserInitials(user: { name: string } | null): string {
    if (!user || !user.name) return '';
    const nameParts = user.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts[1] || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
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
