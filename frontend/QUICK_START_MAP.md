# 🗺️ Google Maps Quick Start Guide

## Step 1: Get Your API Key (5 minutes)

1. Go to: https://console.cloud.google.com/
2. Create project → Enable APIs → Create API Key
3. Enable these 4 APIs:
   - ✅ Maps JavaScript API
   - ✅ Geocoding API
   - ✅ Places API
   - ✅ Directions API

## Step 2: Add API Key (2 minutes)

### File 1: `frontend/src/environments/environment.ts`
```typescript
googleMaps: {
  apiKey: 'YOUR_KEY_HERE' // ← Paste your API key
}
```

### File 2: `frontend/src/environments/environment.prod.ts`
```typescript
googleMaps: {
  apiKey: 'YOUR_KEY_HERE' // ← Paste your API key
}
```

### File 3: `frontend/src/index.html`
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY_HERE&libraries=places,geometry" async defer></script>
```

## Step 3: Use Components (Copy & Paste)

### For Business Location Picker

**In your component:**
```typescript
import { BusinessLocationPickerComponent } from '../business-location-picker/business-location-picker.component';

// Add to imports
imports: [BusinessLocationPickerComponent]

// Add method
onLocationSelected(location: { latitude: number; longitude: number; location: string }) {
  console.log('Location:', location);
  // Update your business here
}
```

**In your template:**
```html
<app-business-location-picker
  (locationSelected)="onLocationSelected($event)"
></app-business-location-picker>
```

### For Map View

**In your routes:**
```typescript
import { BusinessMapViewComponent } from './shared/components/business-map-view/business-map-view.component';

{
  path: 'businesses/map',
  component: BusinessMapViewComponent
}
```

## Step 4: Test

```bash
# Terminal 1
cd backend && npm run start:dev

# Terminal 2
cd frontend && npm start
```

Visit: http://localhost:4200

## That's It! 🎉

**Full docs:**
- 📖 `GOOGLE_MAPS_SETUP.md` - Detailed setup
- 💡 `INTEGRATION_EXAMPLES.md` - Code examples
- 📋 `MAP_IMPLEMENTATION_SUMMARY.md` - Full summary

## Need Help?

**Common issues:**
- Map not loading? → Check browser console
- API error? → Verify key is correct and APIs are enabled
- Referrer error? → Add `localhost:4200` to API restrictions

---

**Free Tier:** $200/month = 28,000 map loads + 40,000 geocoding requests
