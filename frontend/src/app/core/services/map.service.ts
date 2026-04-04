import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Location {
  lat: number;
  lng: number;
}

export interface BusinessLocation {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  category?: string;
  logo?: string;
  description?: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private readonly NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

  constructor(private http: HttpClient) {}

  /**
   * Get current user's location using browser geolocation
   */
  getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Geocode an address to coordinates using Nominatim (OpenStreetMap)
   */
  async geocodeAddress(address: string): Promise<Location> {
    try {
      const url = `${this.NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      const results = await firstValueFrom(
        this.http.get<NominatimResponse[]>(url, {
          headers: {
            'User-Agent': 'CrediScore-App'
          }
        })
      );

      if (results && results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon)
        };
      } else {
        throw new Error('No results found for the address');
      }
    } catch (error) {
      throw new Error('Geocoding failed: ' + (error as Error).message);
    }
  }

  /**
   * Reverse geocode coordinates to an address using Nominatim
   */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `${this.NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}`;
      const result = await firstValueFrom(
        this.http.get<NominatimResponse>(url, {
          headers: {
            'User-Agent': 'CrediScore-App'
          }
        })
      );

      return result.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      // Fallback to coordinates if reverse geocoding fails
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  /**
   * Calculate distance between two points in kilometers using Haversine formula
   */
  calculateDistance(from: Location, to: Location): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.degreesToRadians(to.lat - from.lat);
    const dLon = this.degreesToRadians(to.lng - from.lng);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(from.lat)) *
      Math.cos(this.degreesToRadians(to.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get directions URL for OpenStreetMap
   */
  getDirectionsUrl(destination: Location, origin?: Location): string {
    const baseUrl = 'https://www.openstreetmap.org/directions';
    let url = `${baseUrl}?to=${destination.lat},${destination.lng}`;
    
    if (origin) {
      url = `${baseUrl}?from=${origin.lat},${origin.lng}&to=${destination.lat},${destination.lng}`;
    }
    
    return url;
  }
}
