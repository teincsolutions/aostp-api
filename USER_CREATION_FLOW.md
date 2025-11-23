# User Creation with Welcome Email & Forced Password Change

## Overview

This implementation ensures that when a new user is created by an admin, they receive a welcome email with their credentials and are forced to change their password on first login before accessing any other system features.

---

## Features Implemented

### 1. Database Schema Update

**File:** `prisma/schema.prisma`

- Added `mustChangePassword Boolean @default(false)` field to the `User` model
- Migration created: `20251123120908_add_must_change_password_to_user`

### 2. Welcome Email Template

**File:** `src/templates/emails/user-created.html`

A beautiful, responsive HTML email template that includes:

- Welcome message
- User credentials (email, username, temporary password)
- User role
- Security notice about mandatory password change
- Login button and URL
- Getting started instructions
- Security best practices

### 3. Notification Service

**File:** `src/modules/notifications/notifications.service.ts`

- Added `notifyUserCreated()` method to send welcome emails
- Includes template rendering with placeholder replacement
- Async email sending with error handling
- Logging for success and failure cases

### 4. User Creation Flow

**File:** `src/modules/users/users.service.ts`

Updated `create()` method to:

- Set `mustChangePassword: true` for all new users
- Store the plain password temporarily (before hashing) to include in email
- Call `notificationsService.notifyUserCreated()` to send welcome email
- Email sending is non-blocking (fire-and-forget with error logging)

### 5. JWT & Authentication Updates

**Files:**

- `src/shared/interfaces/index.ts`
- `src/modules/auth/auth.service.ts`

- Added `mustChangePassword?: boolean` to `JwtPayload` interface
- Updated `generateTokens()` to include `mustChangePassword` in JWT payload
- Updated `changePassword()` to clear the `mustChangePassword` flag when password is changed
- Updated login flow to include `mustChangePassword` in user data

### 6. Access Control Guard

**File:** `src/shared/guards/password-change.guard.ts`

New guard that:

- Checks if user has `mustChangePassword: true`
- Blocks access to all protected endpoints except those marked with `@AllowPasswordChange()`
- Returns `403 Forbidden` with helpful message if access is blocked

**File:** `src/shared/decorators/allow-password-change.decorator.ts`

New decorator to mark endpoints that users with pending password changes can access:

- `@AllowPasswordChange()` - marks endpoint as accessible even when password change is required

### 7. Controller Updates

**File:** `src/modules/auth/auth.controller.ts`

Applied `@AllowPasswordChange()` decorator to:

- `GET /auth/me` - allows users to get their profile info
- `POST /auth/change-password` - allows users to change their password

### 8. Global Guard Registration

**File:** `src/app.module.ts`

- Registered `PasswordChangeGuard` as a global guard
- Runs after `JwtAuthGuard` and `RolesGuard`

---

## User Flow

### Admin Creates User

1. Admin calls `POST /users` with user details
2. System hashes the password
3. User is created with `mustChangePassword: true`
4. Welcome email is sent with credentials (async, non-blocking)
5. Admin receives created user data (without password)

### New User Receives Email

User receives a professional email containing:

- Welcome message
- Login credentials (email, username, temporary password)
- Their assigned role
- Security notice about required password change
- Login link/button
- Instructions

### User First Login

1. User calls `POST /auth/login` with credentials
2. If 2FA is not enabled:
   - System returns tokens and user data including `mustChangePassword: true`
3. If 2FA is enabled:
   - System returns `requiresTwoFactor: true`
   - User must then call `POST /auth/login/2fa`
   - System returns tokens and user data including `mustChangePassword: true`

### User Attempts to Access Features

1. User tries to access any protected endpoint (e.g., `GET /packages`)
2. `JwtAuthGuard` validates the token
3. `PasswordChangeGuard` checks `mustChangePassword` flag
4. If `true` and endpoint doesn't have `@AllowPasswordChange()`:
   - System returns `403 Forbidden`
   - Error message: "You must change your password before accessing this resource"

### User Changes Password

1. User calls `POST /auth/change-password` (allowed by `@AllowPasswordChange()`)
   ```json
   {
     "currentPassword": "TempPassword123!",
     "newPassword": "MyNewSecurePass456!"
   }
   ```
2. System validates current password
3. System hashes new password
4. System sets `mustChangePassword: false`
5. System revokes all refresh tokens (forces re-login)
6. User must login again with new password

### User Access Granted

1. User logs in with new password
2. Token includes `mustChangePassword: false`
3. User can now access all authorized endpoints

---

## Allowed Endpoints for Users with Pending Password Change

Only these endpoints are accessible:

- `POST /auth/login` - To authenticate
- `POST /auth/login/2fa` - For 2FA authentication
- `POST /auth/refresh` - To refresh token
- `GET /auth/me` - To view profile (marked with `@AllowPasswordChange()`)
- `POST /auth/change-password` - To change password (marked with `@AllowPasswordChange()`)
- Any endpoint marked with `@Public()` decorator

All other protected endpoints return `403 Forbidden`.

---

## Security Considerations

1. **Temporary Password**: Sent via email, but must be changed immediately
2. **Token Revocation**: All refresh tokens are revoked after password change
3. **Forced Re-login**: User must login again after changing password
4. **JWT Includes Flag**: The `mustChangePassword` flag is in the JWT, preventing token manipulation
5. **Guard-Level Enforcement**: Enforced at the application level, not just frontend

---

## Frontend Implementation Guide

### 1. Handle Login Response

```typescript
const loginResponse = await login({ email, password });

// Check if 2FA is required
if (loginResponse.requiresTwoFactor) {
  // Show 2FA input and call /auth/login/2fa
}

// Check if password change is required
if (loginResponse.user.mustChangePassword) {
  // Redirect to change password page
  // Show message: "For security, you must change your password"
  router.push('/change-password');
}
```

### 2. Change Password Flow

```typescript
try {
  await changePassword({
    currentPassword: tempPassword,
    newPassword: newPassword,
  });

  // Success - all sessions invalidated
  // Clear local tokens
  localStorage.clear();

  // Show success message
  showToast(
    'Password changed successfully. Please login with your new password.',
  );

  // Redirect to login
  router.push('/login');
} catch (error) {
  // Handle error
}
```

### 3. API Interceptor for 403

```typescript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      const message = error.response.data.message;

      if (message.includes('must change your password')) {
        // Redirect to change password page
        router.push('/change-password');
        showToast('Please change your password to continue', 'warning');
      }
    }
    return Promise.reject(error);
  },
);
```

### 4. Route Guard

```typescript
// In your route guard or middleware
if (user.mustChangePassword && currentRoute !== '/change-password') {
  return router.push('/change-password');
}
```

---

## Testing Checklist

- [ ] Admin creates a new user
- [ ] User receives welcome email with correct credentials
- [ ] User can login with temporary password
- [ ] User sees `mustChangePassword: true` in login response
- [ ] User is blocked from accessing protected endpoints (403 error)
- [ ] User can access `/auth/me` endpoint
- [ ] User can change password successfully
- [ ] After password change, all sessions are invalidated
- [ ] User can login with new password
- [ ] User can now access all authorized endpoints
- [ ] User sees `mustChangePassword: false` in subsequent logins

---

## Environment Variables Required

Ensure `FRONTEND_URL` is set in `.env` for the login link in the email:

```env
FRONTEND_URL=https://aostp.akomapacargo.com
```

---

## Migration

Already applied:

```bash
npx prisma migrate dev --name add_must_change_password_to_user
```

If deploying to production:

```bash
npx prisma migrate deploy
```

---

## API Endpoints Summary

| Endpoint                | Method | Requires Auth | Allows Pending Password | Description                        |
| ----------------------- | ------ | ------------- | ----------------------- | ---------------------------------- |
| `/auth/login`           | POST   | No            | Yes                     | Login (returns mustChangePassword) |
| `/auth/login/2fa`       | POST   | No            | Yes                     | 2FA login                          |
| `/auth/refresh`         | POST   | No            | Yes                     | Refresh token                      |
| `/auth/me`              | GET    | Yes           | **Yes**                 | Get current user                   |
| `/auth/change-password` | POST   | Yes           | **Yes**                 | Change password                    |
| `/auth/logout`          | POST   | Yes           | No                      | Logout                             |
| All other endpoints     | \*     | Yes           | No                      | Blocked if mustChangePassword=true |

---

## Notes

1. The welcome email is sent asynchronously and does not block user creation
2. If email fails to send, the user is still created successfully
3. Email failures are logged for admin to review
4. The `mustChangePassword` flag is stored in both database and JWT
5. The guard runs on every authenticated request
6. This applies to all roles: SUPER_ADMIN, FINANCE_MANAGER, OPERATIONS_CLERK, PAYMENT_CLERK, CUSTOMER
