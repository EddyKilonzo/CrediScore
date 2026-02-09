# Map Components Integration Examples

## Example 1: Integrating Business Location Picker in My Business Component

### Step 1: Import the Component

Add to your component imports:

```typescript
import { BusinessLocationPickerComponent } from '../business-location-picker/business-location-picker.component';

@Component({
  selector: 'app-my-business',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BusinessLocationPickerComponent, // Add this
    // ... other imports
  ],
  // ...
})
```

### Step 2: Add to Your Template

In your `my-business.component.html`, add a section for location:

```html
<!-- Location Section -->
<div class="section-card">
  <h3 class="section-title">Business Location</h3>
  <p class="section-description">
    Set your business location to help customers find you on the map
  </p>
  
  <app-business-location-picker
    [initialLocation]="{
      latitude: business?.latitude,
      longitude: business?.longitude,
      location: business?.location
    }"
    (locationSelected)="onLocationSelected($event)"
  ></app-business-location-picker>
</div>
```

### Step 3: Handle Location Selection

Add this method to your component:

```typescript
onLocationSelected(location: { latitude: number; longitude: number; location: string }) {
  if (!this.business) return;
  
  // Show loading
  this.isUpdating = true;
  
  // Update business with new location
  this.businessService.updateBusiness({
    id: this.business.id,
    latitude: location.latitude,
    longitude: location.longitude,
    location: location.location
  }).subscribe({
    next: (updatedBusiness) => {
      this.business = updatedBusiness;
      this.toastService.showSuccess('Location updated successfully!');
      this.isUpdating = false;
    },
    error: (error) => {
      console.error('Error updating location:', error);
      this.toastService.showError('Failed to update location. Please try again.');
      this.isUpdating = false;
    }
  });
}
```

## Example 2: Adding Map View to Navigation

### Step 1: Add Route

In `app.routes.ts`:

```typescript
import { BusinessMapViewComponent } from './shared/components/business-map-view/business-map-view.component';

export const routes: Routes = [
  {
    path: 'businesses/map',
    component: BusinessMapViewComponent,
    title: 'Find Businesses - Map View'
  },
  // ... other routes
];
```

### Step 2: Add Navigation Link

In your navbar component (`navbar.html`):

```html
<li class="nav-item">
  <a routerLink="/businesses/map" routerLinkActive="active" class="nav-link">
    <i class="uil uil-map"></i>
    <span>Map View</span>
  </a>
</li>
```

## Example 3: Standalone Map View Page

Create a new page component:

```typescript
import { Component } from '@angular/core';
import { BusinessMapViewComponent } from '../../shared/components/business-map-view/business-map-view.component';

@Component({
  selector: 'app-find-businesses-map',
  standalone: true,
  imports: [BusinessMapViewComponent],
  template: `
    <div class="page-container">
      <app-business-map-view></app-business-map-view>
    </div>
  `,
  styles: [`
    .page-container {
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class FindBusinessesMapComponent {}
```

## Example 4: Adding "View on Map" Button to Business Cards

In your business list/search results:

```html
<div class="business-card">
  <h3>{{ business.name }}</h3>
  <p>{{ business.description }}</p>
  
  <div class="action-buttons">
    <button (click)="viewDetails(business.id)" class="btn-primary">
      View Details
    </button>
    
    <!-- Add this button if business has location -->
    <button 
      *ngIf="business.latitude && business.longitude"
      (click)="viewOnMap(business)"
      class="btn-secondary"
    >
      <i class="uil uil-map-marker"></i>
      View on Map
    </button>
  </div>
</div>
```

Component method:

```typescript
viewOnMap(business: Business) {
  // Option 1: Navigate to map page with business highlighted
  this.router.navigate(['/businesses/map'], {
    queryParams: { businessId: business.id }
  });
  
  // Option 2: Open directions in new window
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`;
  window.open(directionsUrl, '_blank');
}
```

## Example 5: Inline Map in Business Details Page

Show a small map on the business details page:

```typescript
import { Component, OnInit } from '@angular/core';
import { GoogleMap, MapMarker, GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  template: `
    <div class="business-details">
      <!-- ... other business details ... -->
      
      <!-- Location Section -->
      <div class="location-section" *ngIf="business?.latitude && business?.longitude">
        <h3>Location</h3>
        <p class="address">
          <i class="uil uil-map-marker"></i>
          {{ business.location }}
        </p>
        
        <!-- Small Map -->
        <div class="map-container-small">
          <google-map
            [center]="{ lat: business.latitude, lng: business.longitude }"
            [zoom]="15"
            width="100%"
            height="100%"
          >
            <map-marker
              [position]="{ lat: business.latitude, lng: business.longitude }"
            ></map-marker>
          </google-map>
        </div>
        
        <!-- Get Directions Button -->
        <button (click)="getDirections()" class="btn-directions">
          <i class="uil uil-directions"></i>
          Get Directions
        </button>
      </div>
    </div>
  `,
  styles: [`
    .map-container-small {
      width: 100%;
      height: 300px;
      border-radius: 0.75rem;
      overflow: hidden;
      border: 2px solid #e5e7eb;
      margin: 1rem 0;
    }
    
    .btn-directions {
      width: 100%;
      padding: 0.875rem;
      background-color: #10b981;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }
    
    .btn-directions:hover {
      background-color: #059669;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
    }
  `]
})
export class BusinessDetailComponent implements OnInit {
  business: Business | null = null;
  
  getDirections() {
    if (!this.business) return;
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${this.business.latitude},${this.business.longitude}`;
    window.open(url, '_blank');
  }
}
```

## Example 6: Location Search in Business Registration

During business registration, allow setting location:

```html
<!-- In registration form -->
<form [formGroup]="registrationForm" (ngSubmit)="onSubmit()">
  <!-- ... other fields ... -->
  
  <!-- Location Step -->
  <div class="form-section" *ngIf="currentStep === 3">
    <h3>Set Your Business Location</h3>
    
    <app-business-location-picker
      (locationSelected)="onLocationSelected($event)"
    ></app-business-location-picker>
    
    <!-- Show selected location -->
    <div *ngIf="selectedLocation" class="location-preview">
      <i class="uil uil-check-circle"></i>
      Location set: {{ selectedLocation.location }}
    </div>
  </div>
  
  <!-- Navigation buttons -->
  <div class="form-actions">
    <button type="button" (click)="previousStep()">Previous</button>
    <button type="button" (click)="nextStep()" [disabled]="!selectedLocation">
      Next
    </button>
  </div>
</form>
```

Component:

```typescript
export class BusinessRegistrationComponent {
  selectedLocation: { latitude: number; longitude: number; location: string } | null = null;
  
  onLocationSelected(location: { latitude: number; longitude: number; location: string }) {
    this.selectedLocation = location;
    
    // Update form values
    this.registrationForm.patchValue({
      latitude: location.latitude,
      longitude: location.longitude,
      location: location.location
    });
  }
  
  nextStep() {
    if (!this.selectedLocation) {
      this.toastService.showWarning('Please set your business location');
      return;
    }
    this.currentStep++;
  }
}
```

## Example 7: Filtering Map by User's Current Location

Add a "Near Me" filter:

```typescript
export class BusinessMapViewComponent implements OnInit {
  showNearbyOnly = false;
  nearbyRadius = 5; // km
  
  filterNearby() {
    if (!this.userLocation) {
      this.toastService.showWarning('Please enable location services');
      return;
    }
    
    this.showNearbyOnly = !this.showNearbyOnly;
    
    if (this.showNearbyOnly) {
      this.filteredBusinesses = this.businesses.filter(business => {
        const distance = this.mapService.calculateDistance(
          this.userLocation!,
          { lat: business.latitude, lng: business.longitude }
        );
        return distance <= this.nearbyRadius;
      });
    } else {
      this.filteredBusinesses = [...this.businesses];
    }
  }
}
```

Template:

```html
<button (click)="filterNearby()" class="filter-button">
  <i class="uil uil-location-arrow"></i>
  {{ showNearbyOnly ? 'Show All' : 'Near Me' }}
</button>

<div *ngIf="showNearbyOnly" class="radius-slider">
  <label>Radius: {{ nearbyRadius }}km</label>
  <input 
    type="range" 
    [(ngModel)]="nearbyRadius" 
    (change)="filterNearby()"
    min="1" 
    max="50"
  />
</div>
```

## Example 8: Bulk Location Update for Multiple Branches

If a business has multiple branches:

```typescript
export class BusinessBranchesComponent {
  branches: Branch[] = [];
  
  addBranch() {
    this.branches.push({
      id: crypto.randomUUID(),
      name: '',
      latitude: null,
      longitude: null,
      location: '',
      isEditing: true
    });
  }
  
  updateBranchLocation(branch: Branch, location: any) {
    branch.latitude = location.latitude;
    branch.longitude = location.longitude;
    branch.location = location.location;
    branch.isEditing = false;
    
    // Save to backend
    this.businessService.updateBranch(this.businessId, branch.id, {
      latitude: location.latitude,
      longitude: location.longitude,
      location: location.location
    }).subscribe({
      next: () => this.toastService.showSuccess('Branch location updated'),
      error: () => this.toastService.showError('Failed to update branch')
    });
  }
}
```

## CSS Utility Classes

Add these to your global styles for consistent map styling:

```css
/* Map Container Sizes */
.map-container-small {
  width: 100%;
  height: 300px;
  border-radius: 0.5rem;
  overflow: hidden;
}

.map-container-medium {
  width: 100%;
  height: 500px;
  border-radius: 0.75rem;
  overflow: hidden;
}

.map-container-large {
  width: 100%;
  height: 700px;
  border-radius: 1rem;
  overflow: hidden;
}

/* Map Buttons */
.map-button {
  padding: 0.75rem 1.5rem;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.map-button:hover {
  background-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

/* Location Badge */
.location-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 9999px;
  color: #15803d;
  font-size: 0.875rem;
  font-weight: 500;
}
```

## Tips for Best User Experience

1. **Show Loading States**: Always show a spinner while geocoding or loading maps
2. **Handle Errors Gracefully**: Provide clear error messages if location services fail
3. **Mobile Optimization**: Test on mobile devices - maps can be tricky on small screens
4. **Default Locations**: Provide sensible defaults (e.g., city center) if user denies location
5. **Accessibility**: Ensure map controls are keyboard accessible
6. **Performance**: Lazy load map components to improve initial page load time

---

**Need more examples?** Check the components in:
- `frontend/src/app/business/business-location-picker/`
- `frontend/src/app/shared/components/business-map-view/`
