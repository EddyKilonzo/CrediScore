# Google Maps Integration Setup Guide

## Overview
This guide will help you set up Google Maps integration for your CrediScore application, enabling businesses to set their location and customers to view businesses on an interactive map with directions.

## Features Implemented

### For Businesses:
- **Business Location Picker Component** (`business-location-picker`)
  - Search for address by name
  - Use current device location
  - Click on map to set location
  - Drag marker to fine-tune position
  - Automatic address resolution (reverse geocoding)

### For Customers:
- **Business Map View Component** (`business-map-view`)
  - View all businesses on an interactive map
  - Filter businesses by category
  - Search businesses by name or location
  - View business details in info windows
  - Get directions to businesses
  - Toggle between map and list view
  - See distance from current location

## Step 1: Get Google Maps API Key

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "CrediScore Maps")
4. Click "Create"

### 2. Enable Required APIs

Navigate to "APIs & Services" → "Library" and enable:

- ✅ **Maps JavaScript API** (Required for displaying maps)
- ✅ **Geocoding API** (Required for address to coordinates conversion)
- ✅ **Places API** (Required for location search and autocomplete)
- ✅ **Directions API** (Required for getting directions)

### 3. Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the generated API key
4. **Important:** Secure your API key (see next section)

### 4. Secure Your API Key (Highly Recommended)

1. Click on your API key to edit it
2. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add the following referrers:
     ```
     http://localhost:4200/*
     https://yourdomain.com/*
     ```

3. Under "API restrictions":
   - Select "Restrict key"
   - Select only the APIs you enabled:
     - Maps JavaScript API
     - Geocoding API
     - Places API
     - Directions API

4. Click "Save"

## Step 2: Configure Your Application

### 1. Update Environment Files

Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` with your actual API key in:

**File: `frontend/src/environments/environment.ts`**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  cloudinary: {
    cloudName: 'duymwzfhj',
    apiKey: '449624856366135'
  },
  googleMaps: {
    apiKey: 'AIzaSy...' // Replace with your actual key
  }
};
```

**File: `frontend/src/environments/environment.prod.ts`**
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-api-domain.com',
  cloudinary: {
    cloudName: 'duymwzfhj',
    apiKey: '449624856366135'
  },
  googleMaps: {
    apiKey: 'AIzaSy...' // Replace with your actual key
  }
};
```

### 2. Update index.html

Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` in the Google Maps script tag:

**File: `frontend/src/index.html`**
```html
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSy...&libraries=places,geometry" async defer></script>
```

## Step 3: Using the Components

### Business Location Picker (For Business Owners)

Use this component in your business profile or setup pages:

```typescript
import { BusinessLocationPickerComponent } from './business/business-location-picker/business-location-picker.component';

@Component({
  selector: 'app-my-business',
  standalone: true,
  imports: [BusinessLocationPickerComponent],
  template: `
    <app-business-location-picker
      [initialLocation]="businessLocation"
      (locationSelected)="onLocationSelected($event)"
    />
  `
})
export class MyBusinessComponent {
  businessLocation = {
    latitude: -1.286389,
    longitude: 36.817223,
    location: 'Nairobi, Kenya'
  };

  onLocationSelected(location: { latitude: number; longitude: number; location: string }) {
    console.log('Selected location:', location);
    // Update your business with the new location
    this.updateBusinessLocation(location);
  }

  updateBusinessLocation(location: any) {
    // Call your business service to update the location
    this.businessService.updateBusiness({
      id: this.businessId,
      latitude: location.latitude,
      longitude: location.longitude,
      location: location.location
    }).subscribe({
      next: (business) => {
        console.log('Business location updated:', business);
      },
      error: (error) => {
        console.error('Error updating location:', error);
      }
    });
  }
}
```

### Business Map View (For Customers)

Add this component to show all businesses on a map:

#### Option 1: As a standalone page

```typescript
import { BusinessMapViewComponent } from './shared/components/business-map-view/business-map-view.component';

@Component({
  selector: 'app-find-businesses',
  standalone: true,
  imports: [BusinessMapViewComponent],
  template: `
    <app-business-map-view />
  `
})
export class FindBusinessesComponent {}
```

#### Option 2: Add to your routes

**File: `frontend/src/app/app.routes.ts`**
```typescript
import { BusinessMapViewComponent } from './shared/components/business-map-view/business-map-view.component';

export const routes: Routes = [
  // ... existing routes
  {
    path: 'businesses/map',
    component: BusinessMapViewComponent,
    title: 'Find Businesses - Map View'
  },
  // ... other routes
];
```

## Step 4: Backend Setup (Optional Enhancement)

If you want to add location-based search (find businesses near me), you can add this to your backend:

**File: `backend/src/business/business.service.ts`**

```typescript
async findNearbyBusinesses(latitude: number, longitude: number, radiusKm: number = 10) {
  // Haversine formula to calculate distance
  const businesses = await this.prisma.business.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      status: 'VERIFIED'
    }
  });

  return businesses.filter(business => {
    const distance = this.calculateDistance(
      latitude,
      longitude,
      business.latitude,
      business.longitude
    );
    return distance <= radiusKm;
  }).sort((a, b) => {
    const distA = this.calculateDistance(latitude, longitude, a.latitude, a.longitude);
    const distB = this.calculateDistance(latitude, longitude, b.latitude, b.longitude);
    return distA - distB;
  });
}

private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = this.degreesToRadians(lat2 - lat1);
  const dLon = this.degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.degreesToRadians(lat1)) *
    Math.cos(this.degreesToRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

private degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
```

## Step 5: Testing

### 1. Start Your Application

```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm start
```

### 2. Test Business Location Picker

1. Navigate to your business profile/setup page
2. Try each feature:
   - ✅ Search for an address
   - ✅ Click "Current Location" button
   - ✅ Click anywhere on the map
   - ✅ Drag the marker

### 3. Test Business Map View

1. Navigate to the map view page
2. Verify:
   - ✅ All businesses with locations are displayed
   - ✅ Click on markers to see business info
   - ✅ Search and filter functionality works
   - ✅ "Get Directions" opens Google Maps
   - ✅ "View Details" navigates to business page
   - ✅ Toggle between map and list view

## API Pricing & Quotas

Google Maps Platform offers a **$200 free credit per month** which covers:

- Maps JavaScript API: ~28,000 loads/month
- Geocoding API: ~40,000 requests/month
- Places API: ~15,000 requests/month
- Directions API: ~40,000 requests/month

**Best Practices to Stay Within Free Tier:**

1. Cache geocoding results
2. Implement map loading delays
3. Use the map only when necessary
4. Monitor usage in Google Cloud Console

## Troubleshooting

### Issue: Map not loading

**Solution:**
1. Check browser console for errors
2. Verify API key is correct in both `index.html` and environment files
3. Ensure all required APIs are enabled in Google Cloud Console
4. Check API key restrictions (make sure localhost:4200 is allowed)

### Issue: "RefererNotAllowedMapError"

**Solution:**
- Go to Google Cloud Console → Credentials
- Edit your API key
- Under "Application restrictions", add `http://localhost:4200/*`

### Issue: Geocoding not working

**Solution:**
- Verify Geocoding API is enabled
- Check API key has access to Geocoding API
- Look for errors in browser console

### Issue: "This page can't load Google Maps correctly"

**Solution:**
- Usually means billing is not enabled
- Enable billing in Google Cloud Console (you won't be charged within free tier)
- Or check if API key is invalid

## Security Considerations

1. ✅ **Never commit API keys to version control**
   - Add environment files to `.gitignore`
   - Use environment variables in production

2. ✅ **Use API key restrictions**
   - Restrict by HTTP referrer
   - Restrict to specific APIs only

3. ✅ **Monitor usage**
   - Set up billing alerts
   - Check usage regularly in Google Cloud Console

4. ✅ **For production**, consider:
   - Using a backend proxy to hide API key
   - Implementing rate limiting
   - Using signed URLs for sensitive operations

## Additional Features to Consider

1. **Autocomplete Search**: Add Google Places Autocomplete for better address search
2. **Routing**: Show routes on the map instead of opening Google Maps
3. **Clustering**: Group nearby businesses into clusters for better performance
4. **Street View**: Add street view for business locations
5. **Heatmap**: Show business density in different areas
6. **Custom Markers**: Use business logos as map markers

## Support

If you encounter any issues:

1. Check the [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
2. Review the console logs in your browser
3. Check the Network tab for failed API requests
4. Verify your API key settings in Google Cloud Console

## Files Created/Modified

### New Files:
- ✅ `frontend/src/app/core/services/map.service.ts`
- ✅ `frontend/src/app/business/business-location-picker/business-location-picker.component.ts`
- ✅ `frontend/src/app/business/business-location-picker/business-location-picker.component.html`
- ✅ `frontend/src/app/business/business-location-picker/business-location-picker.component.css`
- ✅ `frontend/src/app/shared/components/business-map-view/business-map-view.component.ts`
- ✅ `frontend/src/app/shared/components/business-map-view/business-map-view.component.html`
- ✅ `frontend/src/app/shared/components/business-map-view/business-map-view.component.css`

### Modified Files:
- ✅ `frontend/src/environments/environment.ts` (added googleMaps config)
- ✅ `frontend/src/environments/environment.prod.ts` (added googleMaps config)
- ✅ `frontend/src/index.html` (added Google Maps script)
- ✅ `frontend/src/app/core/services/business.service.ts` (added getAllPublicBusinesses method)

---

**Ready to get started?** Get your Google Maps API key and replace the placeholders!
