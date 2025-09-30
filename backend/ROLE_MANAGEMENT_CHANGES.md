# Role Management Changes

## Overview
Updated the user registration process to automatically assign the CUSTOMER role to all new users, removing the need for users to select a role during signup.

## Changes Made

### 1. Signup DTO (`backend/src/auth/dto/signup.dto.ts`)
- **Removed**: `role` field from `SignUpDto`
- **Removed**: `IsEnum` import (no longer needed)
- **Result**: Users no longer need to specify a role during registration

### 2. Auth Service (`backend/src/auth/auth.service.ts`)
- **Updated**: User creation to explicitly set `role: 'CUSTOMER'`
- **Result**: All new users are automatically assigned the CUSTOMER role

### 3. User Service (`backend/src/user/user.service.ts`)
- **Updated**: `createBusiness` method to automatically upgrade users to BUSINESS_OWNER
- **Logic**: When a CUSTOMER creates their first business, their role is automatically upgraded to BUSINESS_OWNER
- **Result**: Seamless transition from customer to business owner

### 4. Database Schema (`backend/prisma/schema.prisma`)
- **Already configured**: `role UserRole @default(CUSTOMER)` 
- **Result**: Database level default ensures consistency

### 5. Documentation (`backend/WORKFLOW_DOCUMENTATION.md`)
- **Updated**: User registration flow description
- **Added**: Role management section explaining automatic role assignment and upgrades
- **Updated**: Business owner workflow to reflect automatic role upgrade

## New User Flow

### Registration
1. User fills signup form (name, email, password, phone)
2. System creates user with CUSTOMER role
3. User can immediately start using the platform as a customer

### Role Progression
1. **CUSTOMER**: Default role for all new users
   - Can search businesses
   - Can write reviews
   - Can submit fraud reports
   - Cannot create businesses

2. **BUSINESS_OWNER**: Automatically assigned when user creates first business
   - All CUSTOMER capabilities
   - Can create and manage businesses
   - Can upload documents and payment methods
   - Can view business analytics

3. **ADMIN**: Manually assigned by existing admins
   - All capabilities
   - Can manage users and businesses
   - Can verify businesses and resolve fraud reports

## Benefits

### For Users
- **Simplified signup**: No need to understand or choose roles
- **Natural progression**: Role upgrades happen automatically based on actions
- **Flexibility**: Users can start as customers and become business owners when ready

### For Platform
- **Better UX**: Reduced friction during registration
- **Data consistency**: All users start with the same role
- **Scalability**: Automatic role management reduces admin overhead

### For Business Logic
- **Clear separation**: Role-based access control remains intact
- **Automatic upgrades**: No manual intervention needed for role changes
- **Audit trail**: Role changes are logged for tracking

## API Changes

### Signup Endpoint
**Before:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone": "+254712345678",
  "role": "CUSTOMER"  // User had to specify
}
```

**After:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone": "+254712345678"
  // Role is automatically set to CUSTOMER
}
```

### Business Creation
**New Behavior:**
- When a CUSTOMER creates their first business, their role is automatically upgraded to BUSINESS_OWNER
- No additional API calls needed
- Role change is logged for audit purposes

## Security Considerations

### Access Control
- Role-based guards remain unchanged
- JWT tokens include role information
- Protected routes continue to work as before

### Data Integrity
- Role upgrades are atomic operations
- Failed upgrades don't leave users in inconsistent states
- All role changes are logged

## Migration Notes

### Existing Users
- Existing users with assigned roles are unaffected
- No database migration needed
- Role assignments remain as-is

### New Users
- All new registrations automatically get CUSTOMER role
- Role upgrades happen automatically when needed
- No manual intervention required

## Testing Considerations

### Unit Tests
- Test user creation with automatic CUSTOMER role assignment
- Test automatic role upgrade when creating first business
- Test role-based access control still works

### Integration Tests
- Test complete user journey from registration to business creation
- Test role-based API access
- Test admin role management functionality

## Future Enhancements

### Potential Improvements
1. **Role Downgrade**: Allow users to downgrade from BUSINESS_OWNER to CUSTOMER
2. **Multiple Roles**: Support users having multiple roles simultaneously
3. **Role Expiration**: Time-based role assignments
4. **Role Permissions**: Granular permissions within roles

### Monitoring
- Track role upgrade frequency
- Monitor user progression from CUSTOMER to BUSINESS_OWNER
- Analyze impact on user engagement and business creation rates
