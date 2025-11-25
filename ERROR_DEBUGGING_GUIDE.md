# Error Debugging Guide: 404 Business Not Found

## Problem
```
Failed to load resource: the server responded with a status of 404 (Not Found)
Error loading business: HttpErrorResponse
```

## Root Causes

### 1. **Business ID Doesn't Exist**
- The business with the provided ID doesn't exist in the database
- **Check**: Verify the business ID in the database
- **Solution**: Ensure the business exists before trying to load it

### 2. **Authentication Issues**
- Missing or invalid JWT token
- Token expired
- **Check**: Open browser DevTools → Network tab → Check request headers for `Authorization: Bearer <token>`
- **Solution**: Ensure user is logged in and token is valid

### 3. **Route Mismatch**
- Frontend calling wrong endpoint
- Backend route not registered
- **Check**: Verify the endpoint URL matches backend routes
- **Solution**: Use the correct endpoint (public vs authenticated)

## Solutions Applied

### ✅ Fixed: Use Public Endpoint
Changed `getBusinessById()` to use the public endpoint:
- **Before**: `/api/business/${id}` (requires authentication)
- **After**: `/api/public/business/${id}` (no authentication required)

This allows viewing business details without authentication.

## Debugging Steps

### 1. Check Browser Console
```javascript
// Open DevTools (F12) → Console tab
// Look for the exact error message and status code
```

### 2. Check Network Tab
```javascript
// Open DevTools (F12) → Network tab
// Find the failed request
// Check:
//   - Request URL
//   - Request Method (GET)
//   - Status Code (404, 401, etc.)
//   - Request Headers (Authorization token)
//   - Response body (error message)
```

### 3. Check Backend Logs
```bash
# In backend terminal, look for:
# - "Business not found with ID: <id>"
# - Authentication errors
# - Route not found errors
```

### 4. Verify Business Exists
```sql
-- In your database, check if business exists:
SELECT id, name, status FROM "Business" WHERE id = '<business-id>';
```

### 5. Test API Directly
```bash
# Test public endpoint (no auth):
curl http://localhost:3000/api/public/business/<business-id>

# Test authenticated endpoint (with token):
curl -H "Authorization: Bearer <your-token>" \
     http://localhost:3000/api/business/<business-id>
```

## Common Issues & Fixes

### Issue: 401 Unauthorized
**Cause**: Missing or invalid authentication token
**Fix**: 
- Ensure user is logged in
- Check token expiration
- Verify token is sent in request headers

### Issue: 404 Not Found
**Cause**: Business doesn't exist or wrong endpoint
**Fix**:
- Verify business ID is correct
- Check if using correct endpoint (public vs authenticated)
- Ensure business exists in database

### Issue: CORS Error
**Cause**: Backend not allowing frontend origin
**Fix**: Check `backend/src/main.ts` CORS configuration

## Testing the Fix

1. **Clear browser cache** and reload
2. **Check Network tab** - request should go to `/api/public/business/{id}`
3. **Verify response** - should return 200 with business data
4. **Check console** - no more 404 errors

## If Problem Persists

1. **Check backend is running**: `http://localhost:3000/api`
2. **Check Swagger docs**: `http://localhost:3000/api` (should show all endpoints)
3. **Verify database connection**: Check backend logs
4. **Check business ID format**: Should be a valid UUID

## Additional Notes

- The public endpoint (`/api/public/business/:id`) doesn't require authentication
- The authenticated endpoint (`/api/business/:id`) requires a valid JWT token
- Both endpoints return the same business data, but authenticated endpoint may include additional user-specific data

