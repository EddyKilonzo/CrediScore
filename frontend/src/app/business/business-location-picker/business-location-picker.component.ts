import { Component, OnInit, AfterViewInit, OnDestroy, Output, EventEmitter, Input, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapService, Location } from '../../core/services/map.service';
import { inferNominatimCountryCodes } from '../../core/utils/geo-coords';
import * as L from 'leaflet';

@Component({
  selector: 'app-business-location-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './business-location-picker.component.html',
  styleUrls: ['./business-location-picker.component.css']
})
export class BusinessLocationPickerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @Input() initialLocation?: { latitude: number; longitude: number; location: string };
  @Output() locationSelected = new EventEmitter<{ latitude: number; longitude: number; location: string }>();

  private map!: L.Map;
  private marker: L.Marker | null = null;

  // Map options
  center: L.LatLngExpression = [-1.286389, 36.817223]; // Nairobi default
  zoom = 15;

  // Search and location
  searchAddress: string = '';
  selectedAddress: string = '';
  isLoadingLocation = false;
  errorMessage = '';

  constructor(private mapService: MapService) {}

  ngOnInit() {
    // If initial location is provided, set it
    if (this.initialLocation) {
      const lat = Number(this.initialLocation.latitude);
      const lng = Number(this.initialLocation.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        this.center = [lat, lng];
        this.selectedAddress = this.initialLocation.location || '';
        this.searchAddress = this.selectedAddress;
      }
    }
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

    // Add marker if initial location exists
    if (this.initialLocation) {
      const lat = Number(this.initialLocation.latitude);
      const lng = Number(this.initialLocation.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        this.addMarker([lat, lng]);
      }
    }
    if (
      !this.initialLocation ||
      !Number.isFinite(Number(this.initialLocation.latitude)) ||
      !Number.isFinite(Number(this.initialLocation.longitude))
    ) {
      // Try to get user's current location
      this.getUserLocation();
    }

    // Handle map clicks
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.onMapClick(e);
    });
  }

  /**
   * Add or update marker on the map
   */
  private addMarker(latlng: L.LatLngExpression) {
    // Remove existing marker if any
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Create custom icon
    const customIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add new marker
    this.marker = L.marker(latlng, {
      icon: customIcon,
      draggable: true
    }).addTo(this.map);

    // Handle marker drag
    this.marker.on('dragend', (e: L.DragEndEvent) => {
      this.onMarkerDragEnd(e);
    });
  }

  /**
   * Get user's current location
   */
  async getUserLocation() {
    this.isLoadingLocation = true;
    this.errorMessage = '';
    
    try {
      const location = await this.mapService.getCurrentLocation();
      const latlng: L.LatLngExpression = [location.lat, location.lng];
      
      this.map.setView(latlng, this.zoom);
      this.addMarker(latlng);
      
      // Get address from coordinates
      const address = await this.mapService.reverseGeocode(location.lat, location.lng);
      this.selectedAddress = address;
      this.searchAddress = address;
      
      this.emitLocation(location.lat, location.lng);
    } catch (error) {
      console.error('Error getting location:', error);
      this.errorMessage = 'Could not get your current location. Please search for an address or click on the map.';
    } finally {
      this.isLoadingLocation = false;
    }
  }

  /**
   * Search for an address
   */
  async searchLocation() {
    if (!this.searchAddress.trim()) {
      return;
    }

    this.isLoadingLocation = true;
    this.errorMessage = '';

    try {
      const location = await this.mapService.geocodeAddress(
        this.searchAddress,
        inferNominatimCountryCodes(this.searchAddress),
      );
      const latlng: L.LatLngExpression = [location.lat, location.lng];
      
      this.map.setView(latlng, this.zoom);
      this.addMarker(latlng);
      this.selectedAddress = this.searchAddress;
      
      this.emitLocation(location.lat, location.lng);
    } catch (error) {
      console.error('Error geocoding address:', error);
      this.errorMessage = 'Could not find the address. Please try a different search term.';
    } finally {
      this.isLoadingLocation = false;
    }
  }

  /**
   * Handle map click to place marker
   */
  async onMapClick(event: L.LeafletMouseEvent) {
    const { lat, lng } = event.latlng;
    
    this.addMarker([lat, lng]);
    this.isLoadingLocation = true;
    
    try {
      const address = await this.mapService.reverseGeocode(lat, lng);
      this.selectedAddress = address;
      this.searchAddress = address;
      this.emitLocation(lat, lng);
    } catch (error) {
      console.error('Error getting address:', error);
      this.emitLocation(lat, lng);
    } finally {
      this.isLoadingLocation = false;
    }
  }

  /**
   * Handle marker drag
   */
  async onMarkerDragEnd(event: L.DragEndEvent) {
    const { lat, lng } = event.target.getLatLng();
    
    this.isLoadingLocation = true;
    
    try {
      const address = await this.mapService.reverseGeocode(lat, lng);
      this.selectedAddress = address;
      this.searchAddress = address;
      this.emitLocation(lat, lng);
    } catch (error) {
      console.error('Error getting address:', error);
      this.emitLocation(lat, lng);
    } finally {
      this.isLoadingLocation = false;
    }
  }

  /**
   * Emit the selected location
   */
  private emitLocation(lat: number, lng: number) {
    this.locationSelected.emit({
      latitude: lat,
      longitude: lng,
      location: this.selectedAddress
    });
  }

  /**
   * Clear selection
   */
  clearSelection() {
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    this.selectedAddress = '';
    this.searchAddress = '';
    this.errorMessage = '';
  }
}
