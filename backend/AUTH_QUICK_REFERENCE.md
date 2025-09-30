# Authentication & Authorization Quick Reference

## 🚀 Quick Start

### 1. Start the Server
```bash
cd backend
npm run start:dev
```

### 2. Access Swagger UI
Open: `http://localhost:3000/api`

### 3. Register & Login
```bash
# Register
POST /auth/signup
{
  "name": "Your Name",
  "email": "you@example.com",
  "password": "SecurePass123!"
}

# Login
POST /auth/login
{
  "email": "you@example.com",
  "password": "SecurePass123!"
}
```

### 4. Use Protected Endpoints
```bash
# Add token to header
Authorization: Bearer <your-access-token>
```

---

## 📋 Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. POST /auth/signup or /auth/login
       ▼
┌─────────────────────┐
│  Auth Controller    │
└──────────┬──────────┘
           │
           │ 2. Validate credentials
           ▼
┌─────────────────────┐
│   Auth Service      │
│  - Hash password    │
│  - Verify user      │
└──────────┬──────────┘
           │
           │ 3. Generate JWT
           ▼
┌─────────────────────┐
│   JWT Service       │
│  - Sign token       │
│  - Set expiration   │
└──────────┬──────────┘
           │
           │ 4. Return token
           ▼
┌─────────────┐
│   Client    │
│ (Store JWT) │
└─────────────┘
```

---

## 🛡️ Authorization Flow

```
┌─────────────┐
│   Client    │
│ (Has Token) │
└──────┬──────┘
       │
       │ 1. Request with JWT
       │    Authorization: Bearer <token>
       ▼
┌─────────────────────┐
│  Global JWT Guard   │
│  - Verify token     │
│  - Extract payload  │
└──────────┬──────────┘
           │
           │ 2. Check if @Public()
           ▼
┌─────────────────────┐
│  Public Decorator?  │
│   Yes → Allow       │
│   No → Continue     │
└──────────┬──────────┘
           │
           │ 3. Get user from DB
           ▼
┌─────────────────────┐
│   JWT Strategy      │
│  - Load user        │
│  - Check isActive   │
└──────────┬──────────┘
           │
           │ 4. Check roles
           ▼
┌─────────────────────┐
│  Global Roles Guard │
│  - Check @Roles()   │
│  - Verify user role │
└──────────┬──────────┘
           │
           │ 5. Allow/Deny
           ▼
┌─────────────────────┐
│   Route Handler     │
│  (@CurrentUser())   │
└─────────────────────┘
```

---

## 🔑 User Roles

| Role | Permissions | Use Cases |
|------|-------------|-----------|
| **CUSTOMER** | • Leave reviews<br>• Report fraud<br>• View businesses | Regular users |
| **BUSINESS_OWNER** | • Manage businesses<br>• Upload documents<br>• Add payment info | Business owners |
| **ADMIN** | • All permissions<br>• Manage users<br>• Verify businesses | Platform admins |

---

## 🎯 Decorators Cheat Sheet

### @Public() - Make endpoint public
```typescript
@Public()
@Get('items')
findAll() {
  return this.itemsService.findAll();
}
```

### @Roles() - Restrict by role
```typescript
@Roles(UserRole.ADMIN)
@Delete('items/:id')
delete(@Param('id') id: string) {
  return this.itemsService.delete(id);
}
```

### @CurrentUser() - Get authenticated user
```typescript
@Post('items')
create(@CurrentUser() user: UserWithoutPassword) {
  return this.itemsService.create(user.id);
}
```

### Combining decorators
```typescript
@Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
@Post('business')
createBusiness(
  @CurrentUser() user: UserWithoutPassword,
  @Body() dto: CreateBusinessDto
) {
  return this.businessService.create(user, dto);
}
```

---

## 📦 DTOs Reference

### SignUpDto
```typescript
{
  name: string;      // Required, min 2 chars
  email: string;     // Required, valid email
  password: string;  // Required, min 6 chars
}
```

### LoginDto
```typescript
{
  email: string;     // Required
  password: string;  // Required
}
```

### ChangePasswordDto
```typescript
{
  currentPassword: string;  // Required
  newPassword: string;      // Required, min 6 chars
}
```

### ForgotPasswordDto
```typescript
{
  email: string;  // Required, valid email
}
```

### ResetPasswordDto
```typescript
{
  token: string;        // Required, reset token
  newPassword: string;  // Required, min 6 chars
}
```

---

## 🔐 Response Types

### SignUpResponseDto / LoginResponseDto
```typescript
{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "BUSINESS_OWNER" | "ADMIN";
  reputation?: number;
  isActive?: boolean;
  lastLoginAt?: Date;
  accessToken: string;  // JWT token
  expiresIn?: number;   // Seconds until expiration
  createdAt: Date;
}
```

### UserWithoutPassword (from @CurrentUser())
```typescript
{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  reputation: number;
  isActive: boolean;
  provider: AuthProvider;
  providerId: string | null;
  avatar: string | null;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🌐 Environment Variables

```env
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/crediscore_db"
JWT_SECRET="your-super-secret-key-min-32-chars"

# Optional (with defaults)
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
JWT_EXPIRES_IN="24h"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
```

---

## 🐛 Common Issues & Solutions

### Issue: "Unauthorized" on protected endpoints
**Solution**: Include JWT token in header
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Issue: "Email already registered"
**Solution**: Use different email or login with existing account

### Issue: "Forbidden resource"
**Solution**: Check user role - may need ADMIN or BUSINESS_OWNER role

### Issue: JWT token expired
**Solution**: Login again to get new token (tokens expire after 24h)

### Issue: Google OAuth not working
**Solution**: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

---

## 📊 Swagger UI Testing Workflow

1. **Open Swagger**: `http://localhost:3000/api`
2. **Register**: Expand `POST /auth/signup`, click "Try it out"
3. **Copy Token**: From response, copy `accessToken`
4. **Authorize**: Click 🔓 "Authorize" button at top
5. **Enter Token**: Type `Bearer <paste-token-here>`
6. **Test Protected Routes**: All endpoints now work!

---

## 🚦 HTTP Status Codes

| Code | Meaning | When It Happens |
|------|---------|----------------|
| 200 | OK | Successful request |
| 201 | Created | User successfully registered |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Invalid/missing JWT token |
| 403 | Forbidden | Insufficient role permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Internal server error |

---

## 📚 Additional Resources

- **Full Guide**: `AUTH_GUIDE.md`
- **Status Report**: `AUTHENTICATION_STATUS.md`
- **Swagger Docs**: `http://localhost:3000/api`
- **NestJS Docs**: https://docs.nestjs.com/security/authentication

---

## 💡 Tips & Best Practices

1. **Always use HTTPS in production**
2. **Store JWT securely** (httpOnly cookies or secure storage)
3. **Never log JWT tokens**
4. **Implement rate limiting** on auth endpoints
5. **Use strong passwords** (implement password policy)
6. **Rotate JWT secrets** periodically in production
7. **Monitor failed login attempts**
8. **Use refresh tokens** for better UX
9. **Implement account recovery** flow
10. **Regular security audits**
