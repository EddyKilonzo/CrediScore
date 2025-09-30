# CrediScore Authentication & Authorization Guide

## Overview

CrediScore uses a comprehensive authentication and authorization system built with NestJS, JWT tokens, and role-based access control (RBAC).

## Features

### ✅ Implemented

1. **JWT Authentication**
   - Token-based authentication with 24-hour expiry
   - Secure password hashing using bcrypt
   - Global JWT guard protecting all routes by default

2. **User Registration & Login**
   - Email/password registration
   - Email/password login
   - User profile management

3. **OAuth Integration**
   - Google OAuth 2.0 support
   - Automatic user creation for OAuth users
   - Email verification for OAuth users

4. **Password Management**
   - Change password (for authenticated users)
   - Forgot password (email-based reset)
   - Reset password with token

5. **Role-Based Access Control (RBAC)**
   - Three user roles: `CUSTOMER`, `BUSINESS_OWNER`, `ADMIN`
   - Global RolesGuard for protecting endpoints by role
   - `@Roles()` decorator for specifying required roles

6. **Security Features**
   - Global authentication by default (opt-out with `@Public()`)
   - Password hashing with bcrypt (10 rounds)
   - Active user validation
   - Last login tracking

## User Roles

```typescript
enum UserRole {
  CUSTOMER        // Regular users who can leave reviews
  BUSINESS_OWNER  // Business owners who can manage businesses
  ADMIN           // Platform administrators
}
```

## API Endpoints

### Public Endpoints (No Authentication Required)

| Method | Endpoint                  | Description                      |
|--------|---------------------------|----------------------------------|
| POST   | `/auth/signup`            | Register a new user              |
| POST   | `/auth/login`             | Login with email/password        |
| POST   | `/auth/forgot-password`   | Request password reset           |
| POST   | `/auth/reset-password`    | Reset password with token        |
| GET    | `/auth/google`            | Initiate Google OAuth            |
| GET    | `/auth/google/callback`   | Google OAuth callback            |
| GET    | `/`                       | Health check                     |

### Protected Endpoints (JWT Required)

| Method | Endpoint                  | Description                      |
|--------|---------------------------|----------------------------------|
| GET    | `/auth/profile`           | Get current user profile         |
| PATCH  | `/auth/change-password`   | Change user password             |
| POST   | `/auth/logout`            | Logout user                      |

## Usage Examples

### 1. User Registration

```bash
POST /auth/signup
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}

# Response
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": null,
  "role": "CUSTOMER",
  "createdAt": "2025-09-30T...",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. User Login

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

# Response
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "CUSTOMER",
  "reputation": 0,
  "isActive": true,
  "lastLoginAt": "2025-09-30T...",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

### 3. Access Protected Endpoint

```bash
GET /auth/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Response
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "CUSTOMER",
  "reputation": 0,
  "isActive": true,
  ...
}
```

### 4. Change Password

```bash
PATCH /auth/change-password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!"
}
```

## Developer Guide

### Protecting Endpoints

By default, **all endpoints are protected** by the global JWT guard. To make an endpoint public, use the `@Public()` decorator:

```typescript
import { Public } from './auth/decorators/public.decorator';

@Controller('items')
export class ItemsController {
  
  // This endpoint is PUBLIC (no auth required)
  @Public()
  @Get()
  findAll() {
    return this.itemsService.findAll();
  }
  
  // This endpoint is PROTECTED (JWT required)
  @Post()
  create(@Body() createDto: CreateDto) {
    return this.itemsService.create(createDto);
  }
}
```

### Role-Based Authorization

Use the `@Roles()` decorator to restrict endpoints to specific user roles:

```typescript
import { Roles } from './auth/decorators/roles.decorator';
import { UserRole } from './auth/dto/user-role.enum';

@Controller('admin')
export class AdminController {
  
  // Only ADMIN users can access this
  @Roles(UserRole.ADMIN)
  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }
  
  // ADMIN and BUSINESS_OWNER can access this
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }
}
```

### Getting Current User

Use the `@CurrentUser()` decorator to access the authenticated user:

```typescript
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { UserWithoutPassword } from './auth/interfaces/user.interface';

@Controller('posts')
export class PostsController {
  
  @Post()
  create(
    @CurrentUser() user: UserWithoutPassword,
    @Body() createDto: CreatePostDto
  ) {
    return this.postsService.create(user.id, createDto);
  }
}
```



## Security Best Practices

1. **JWT Secret**: Use a strong, randomly generated secret in production
2. **HTTPS**: Always use HTTPS in production
3. **Token Storage**: Store JWT tokens securely (httpOnly cookies or secure storage)
4. **Password Policy**: Enforce strong passwords (implement validation)
5. **Rate Limiting**: Implement rate limiting on authentication endpoints
6. **Token Refresh**: Consider implementing refresh tokens for better security

## Database Schema

The User model includes the following authentication-related fields:

```prisma
model User {
  id            String       @id @default(uuid())
  email         String       @unique
  password      String?      // Optional for OAuth users
  role          UserRole     @default(CUSTOMER)
  isActive      Boolean      @default(true)
  provider      AuthProvider @default(LOCAL)
  providerId    String?      // OAuth provider ID
  emailVerified Boolean      @default(false)
  lastLoginAt   DateTime?
  ...
}
```

## Testing Authentication

Use the Swagger documentation at `http://localhost:3000/api` to test all authentication endpoints interactively.

### Testing Workflow:

1. Register a new user via `/auth/signup`
2. Copy the `accessToken` from the response
3. Click "Authorize" button in Swagger UI
4. Enter: `Bearer <your-access-token>`
5. Now you can test all protected endpoints

## TODO / Planned Features

- [ ] Email verification service
- [ ] Password reset email sending
- [ ] Refresh token implementation
- [ ] Two-factor authentication (2FA)
- [ ] Session management and token blacklisting
- [ ] Social login (Facebook, Twitter)
- [ ] Account lockout after failed attempts
- [ ] Audit logging for security events

## Troubleshooting

### Common Issues

**Issue**: "Unauthorized" on protected endpoints
- **Solution**: Ensure you're sending the JWT token in the `Authorization` header as `Bearer <token>`

**Issue**: "Email already registered"
- **Solution**: Use a different email or login with existing credentials

**Issue**: Google OAuth not working
- **Solution**: Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`

**Issue**: JWT token expired
- **Solution**: Login again to get a new token (tokens expire after 24 hours)

## Support

For questions or issues, please refer to the main README or contact the development team.
