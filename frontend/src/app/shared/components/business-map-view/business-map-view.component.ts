import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Input,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MapService, BusinessLocation, Location } from '../../../core/services/map.service';
import { correctLikelyEastAfricaLatLngSwap } from '../../../core/utils/geo-coords';
import { BusinessService } from '../../../core/services/business.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-business-map-view',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './business-map-view.component.html',
  styleUrls: ['./business-map-view.component.css']
})
export class BusinessMapViewComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  /** When true (e.g. on /search map tab): no duplicate header/filters; markers come from parent */
  @Input() embedded = false;
  /** Filtered businesses with coordinates — must stay in sync with search page filters */
  @Input() externalLocations?: BusinessLocation[];

  private map!: L.Map;
  private markers: Map<string, L.Marker> = new Map();

  // Map settings
  center: L.LatLngExpression = [-1.286389, 36.817223]; // Nairobi default
  zoom = 12;

  // Data
  businesses: BusinessLocation[] = [];
  filteredBusinesses: BusinessLocation[] = [];
  selectedBusiness: BusinessLocation | null = null;
  userLocation: Location | null = null;

  // UI state
  isLoading = false;
  errorMessage = '';
  searchQuery = '';
  selectedCategory = 'all';
  categories: string[] = [];
  showList = false;

  constructor(
    private mapService: MapService,
    private businessService: BusinessService,
    private router: Router
  ) {}

  ngOnInit() {
    if (this.embedded) {
      this.applyExternalLocations(this.externalLocations ?? []);
    } else {
      this.loadBusinesses();
      this.getUserLocation();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.embedded || !changes['externalLocations'] || changes['externalLocations'].firstChange) {
      return;
    }
    this.applyExternalLocations(this.externalLocations ?? []);
    if (this.map) {
      this.updateMarkers();
      if (this.filteredBusinesses.length > 0) {
        this.centerMapOnBusinesses();
      } else {
        this.map.setView(this.center as L.LatLngExpression, this.zoom);
      }
    }
  }

  private applyExternalLocations(list: BusinessLocation[]): void {
    this.businesses = [...list];
    this.filteredBusinesses = [...list];
    this.categories = [...new Set(list.map((b) => b.category).filter((c): c is string => !!c))];
    this.isLoading = false;
    this.errorMessage = '';
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Initialize the Leaflet map
   */
  private initMap() {
    // Initialize map
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.center,
      zoom: this.zoom,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 5
    }).addTo(this.map);

    // Add markers if businesses are loaded
    if (this.filteredBusinesses.length > 0) {
      this.updateMarkers();
    }
  }

  /**
   * Update markers on the map
   */
  private updateMarkers() {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(marker => this.map.removeLayer(marker));
    this.markers.clear();

    // Add markers for filtered businesses
    this.filteredBusinesses.forEach(business => {
      const marker = L.marker([business.latitude, business.longitude], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      });

      // Create popup content
      const popupContent = this.createPopupContent(business);
      marker.bindPopup(popupContent);

      // Add click event
      marker.on('click', () => {
        this.selectedBusiness = business;
      });

      marker.addTo(this.map);
      this.markers.set(business.id, marker);
    });

    // Add user location marker if available
    if (this.userLocation) {
      const userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).bindPopup('Your Location').addTo(this.map);
    }

    // Fit bounds if there are businesses
    if (this.filteredBusinesses.length > 0) {
      this.centerMapOnBusinesses();
    }
  }

  /**
   * Create popup content HTML
   */
  private createPopupContent(business: BusinessLocation): string {
    const distance = this.userLocation ? this.getDistance(business) : '';
    const distanceHtml = distance ? `<p><i class="uil uil-direction"></i> ${distance} away</p>` : '';
    
    return `
      <div class="popup-content" style="min-width: 200px;">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${business.name}</h3>
        ${business.category ? `<p style="margin: 0.25rem 0; color: #3b82f6; font-size: 0.875rem;">${business.category}</p>` : ''}
        <p style="margin: 0.5rem 0; color: #6b7280; font-size: 0.875rem;">
          <i class="uil uil-map-marker"></i> ${business.location}
        </p>
        ${distanceHtml}
        <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
          <button onclick="window.viewBusinessDetails('${business.id}')" 
                  style="flex: 1; padding: 0.5rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; cursor: pointer;">
            View Details
          </button>
          <button onclick="window.getBusinessDirections(${business.latitude}, ${business.longitude})" 
                  style="flex: 1; padding: 0.5rem; background: #10b981; color: white; border: none; border-radius: 0.375rem; cursor: pointer;">
            Directions
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Load all businesses with locations
   */
  async loadBusinesses() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const response: any = await this.businessService.getAllPublicBusinesses().toPromise();
      
      // Handle different response formats
      const businessList = Array.isArray(response) ? response : (response?.businesses || []);
      
      // Filter businesses that have valid locations (onboarding saves lat/lng here)
      this.businesses = businessList
        .filter((b: any) => {
          const lat = Number(b.latitude);
          const lng = Number(b.longitude);
          return Number.isFinite(lat) && Number.isFinite(lng);
        })
        .map((b: any) => {
          let lat = Number(b.latitude);
          let lng = Number(b.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const fixed = correctLikelyEastAfricaLatLngSwap(lat, lng);
            lat = fixed.lat;
            lng = fixed.lng;
          }
          return {
            id: b.id,
            name: b.name,
            location: b.location || 'Location not specified',
            latitude: lat,
            longitude: lng,
            category: b.businessCategory?.name || b.category || null,
            logo: b.logo,
            description: b.description,
          };
        });

      this.filteredBusinesses = [...this.businesses];

      // Extract unique categories
      this.categories = [...new Set(this.businesses.map(b => b.category).filter(c => c))] as string[];

      // Update markers if map is ready
      if (this.map) {
        this.updateMarkers();
      }
    } catch (error) {
      console.error('Error loading businesses:', error);
      this.errorMessage = 'Failed to load businesses. Please try again later.';
    } finally {
      this.isLoading = false;
    }

    // Setup global functions for popup buttons
    (window as any).viewBusinessDetails = (id: string) => {
      this.viewBusinessDetails(id);
    };
    (window as any).getBusinessDirections = (lat: number, lng: number) => {
      this.getDirections({ id: '', name: '', location: '', latitude: lat, longitude: lng });
    };
  }

  /**
   * Get user's current location
   */
  async getUserLocation() {
    try {
      this.userLocation = await this.mapService.getCurrentLocation();
      // Center map on user location; businesses markers are already shown
      if (this.map) {
        this.map.setView([this.userLocation.lat, this.userLocation.lng], this.zoom);
        this.updateMarkers();
      } else {
        // map not yet ready — store for initMap to pick up
        this.center = [this.userLocation.lat, this.userLocation.lng];
      }
    } catch (error) {
      console.log('Could not get user location:', error);
    }
  }

  /**
   * Center map on all businesses
   */
  centerMapOnBusinesses() {
    if (!this.map || this.filteredBusinesses.length === 0) return;

    if (this.filteredBusinesses.length === 1) {
      const b = this.filteredBusinesses[0];
      this.map.setView([b.latitude, b.longitude], 14);
      return;
    }

    const bounds = L.latLngBounds(
      this.filteredBusinesses.map(b => [b.latitude, b.longitude] as L.LatLngExpression)
    );

    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  /**
   * Filter businesses by search and category
   */
  filterBusinesses() {
    let filtered = this.businesses;

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        b.name.toLowerCase().includes(query) ||
        b.location.toLowerCase().includes(query) ||
        b.description?.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(b => b.category === this.selectedCategory);
    }

    this.filteredBusinesses = filtered;

    // Update map markers
    if (this.map) {
      this.updateMarkers();
    }
  }

  /**
   * Get directions to a business
   */
  getDirections(business: BusinessLocation) {
    const destination: Location = {
      lat: business.latitude,
      lng: business.longitude
    };
    
    const directionsUrl = this.mapService.getDirectionsUrl(destination, this.userLocation || undefined);
    window.open(directionsUrl, '_blank');
  }

  /**
   * Navigate to business details
   */
  viewBusinessDetails(businessId: string) {
    this.router.navigate(['/business', businessId]);
  }

  /**
   * Calculate distance to business
   */
  getDistance(business: BusinessLocation): string {
    if (!this.userLocation) return 'N/A';

    const distance = this.mapService.calculateDistance(
      this.userLocation,
      { lat: business.latitude, lng: business.longitude }
    );

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }

  /**
   * Toggle list view
   */
  toggleListView() {
    this.showList = !this.showList;
  }

  /**
   * Zoom to specific business
   */
  zoomToBusiness(business: BusinessLocation) {
    this.selectedBusiness = business;
    
    if (this.map) {
      this.map.setView([business.latitude, business.longitude], 16);
      
      // Open the marker popup
      const marker = this.markers.get(business.id);
      if (marker) {
        marker.openPopup();
      }
    }
  }
}
