Crypto Exchange Backend
A production-style backend for a centralized crypto exchange, built as a learning project to understand real exchange engineering beyond basic CRUD APIs.

The project currently focuses on account security, authentication, 2FA, trusted devices, profile data, and KYC foundations. The long-term goal is to grow this into a mini exchange backend with wallets, ledger correctness, matching engine, order book, market data, WebSockets, Kafka events, BullMQ jobs, and admin operations.

Tech Stack
Node.js
Express
PostgreSQL
Prisma 7
@prisma/adapter-pg
Redis
JWT access and refresh tokens
HttpOnly cookies
Google Authenticator compatible TOTP 2FA
AES-256-GCM encryption for 2FA secrets
Nodemailer for email flows
Current Features
Authentication
User signup
Password hashing with bcrypt
Email verification tokens
Login
Logout
Refresh token rotation foundation
Forgot password
Reset password
HttpOnly cookie based auth
Redis-backed session/token state
Two-Factor Authentication
Google Authenticator setup
QR code generation
Manual setup key
OTP setup verification
Login-side 2FA challenge flow
Temporary 2FA login tokens
Trusted devices
Recent 2FA verification for sensitive actions
2FA attempt limiting with Redis
User Profile
Authenticated profile endpoint
Email verification status
2FA status
KYC status
Role support with USER and ADMIN
KYC Foundation
User KYC submission
KYC status endpoint
Pending submission protection
KYC document type enum
User-level KYC status tracking
Admin role foundation
Project Structure
Backend/
  app.js
  config/
    prisma.js
    redis.js
  controllers/
    auth.controller.js
    kyc.controller.js
    twofa.controller.js
    user.controller.js
  middleware/
    authentication.js
    checkRecentTwoFa.js
    errorHandler.js
    requireAdmin.js
  router/
    auth.js
    kyc.js
    twofa.js
    user.js
  services/
    auth-service/
      auth.service.js
      email.service.js
      session.service.js
    twofa-service/
      recentTwoFa.service.js
      trustedDevice.service.js
      twoFaLogin.service.js
      twofa.service.js
      twofaAttempt.service.js
      twofaToken.service.js
    user-kyc-service/
      kyc.service.js
      userProfile.service.js
  utils/
    AppError.js
    asyncWrapper.js
    consts.js
    encryption.js
    hashToken.js
    token.js
    tokenGenrator.js
    validateOtp.js
  validators/
    kyc.validator.js

prisma/
  auth/
    schema.prisma

prisma.config.js
package.json
Architecture Rules
The codebase follows a layered backend structure:

Controller: HTTP request/response, cookies, and status codes
Service: business logic and database operations
Utils: reusable helpers
Middleware: request guards
Validators: request body validation and normalization
PostgreSQL: durable data
Redis: temporary state, sessions, rate limits, and recent verification windows
API Routes
Auth
Base path:

/auth
Method	Route	Purpose
POST	/signup	Create user account
GET	/verify-email	Verify email token
POST	/forgot-password	Request password reset email
POST	/reset-password	Reset password using reset token
POST	/login	Login with email/password
POST	/logout	Logout and clear cookies
POST	/refresh	Rotate refresh token
2FA
Base path:

/auth/2fa
Method	Route	Purpose
POST	/setup	Start Google Authenticator setup
POST	/verify-setup	Verify setup OTP and enable 2FA
POST	/verify-login	Complete login after 2FA challenge
POST	/verify-recent	Mark recent 2FA for sensitive actions
GET	/trusted-devices	List trusted devices
DELETE	/trusted-devices/:trustedDeviceId	Revoke trusted device
User
Base path:

/user
Method	Route	Purpose
GET	/profile	Get authenticated user profile
KYC
Base path:

/kyc
Method	Route	Purpose
GET	/status	Get current user KYC status
POST	/submit	Submit KYC details
Environment Variables
Create a .env file in the project root.

Example:

PORT=3000

DATABASE_URL="postgresql://postgres:YOUR_ENCODED_PASSWORD@localhost:5432/crypto_auth"

JWT_ACCESS_SECRET="your-access-token-secret"
JWT_REFRESH_SECRET="your-refresh-token-secret"

REDIS_URL="redis://localhost:6379"

TWO_FA_ENCRYPTION_KEY="64_hex_character_key"

EMAIL_USER="your-email@example.com"
EMAIL_PASS="your-email-app-password"

FRONTEND_URL="http://localhost:5173"
Important:

If your database password contains @, encode it as %40.
TWO_FA_ENCRYPTION_KEY must be 64 hex characters.
Generate a 2FA encryption key:

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Prisma Setup
This project uses Prisma 7 with prisma.config.js.

The datasource URL is configured through prisma.config.js, not directly inside schema.prisma.

Generate Prisma Client:

npx prisma generate --schema prisma/auth/schema.prisma
Run migrations:

npx prisma migrate dev --schema prisma/auth/schema.prisma
Check migration status:

npx prisma migrate status --schema prisma/auth/schema.prisma
Running Locally
Install dependencies:

npm install
Start PostgreSQL and Redis locally.

Run the backend:

npm run dev
Default backend URL:

http://localhost:3000
Security Design
This backend uses several production-style security patterns:

Passwords are hashed, never encrypted
Email verification tokens are hashed in the database
Password reset tokens are hashed in the database
Temporary 2FA login tokens are hashed in the database
Trusted device tokens are hashed in the database
TOTP secrets are encrypted because they must be decrypted later for OTP verification
Access and refresh tokens are stored in HttpOnly cookies
2FA login does not issue access/refresh cookies until OTP is verified
Trusted devices only skip login OTP
Sensitive actions can still require recent 2FA
Current 2FA Login Flow
1. User submits email and password
2. Backend checks password
3. If 2FA is disabled, login completes
4. If 2FA is enabled and device is trusted, login completes
5. If 2FA is enabled and device is not trusted, backend returns:
   { requiresTwoFa: true, twoFaToken }
6. Frontend sends twoFaToken + OTP to /auth/2fa/verify-login
7. Backend verifies temp token and OTP
8. Backend creates access/refresh cookies
9. If rememberDevice is true, backend creates trustedDeviceToken cookie
KYC Design
KYC data is separated from the core User table.

User.kycStatus stores the current account-level state:

NOT_SUBMITTED
PENDING
APPROVED
REJECTED
KycSubmission stores the submitted identity details and review status.

This allows the system to keep submission history instead of overwriting old reviews.

Admin Design
Admins are not created through public signup.

For local development, promote a user manually in the database:

UPDATE "User"
SET role = 'ADMIN'
WHERE email = 'your-email@example.com';
Admin-only routes should use:

authentication middleware
requireAdmin middleware
Roadmap
Auth and Security
DB-backed session management
Session/device history
Revoke individual sessions
Revoke all sessions
Change password
Disable 2FA with OTP
Backup codes
Anti-phishing code
Security event emails
CSRF strategy for cookie auth
KYC
Admin KYC listing
Admin approve/reject flow
KYC document upload
Rejection/resubmission flow
KYC review audit log
KYC-based account limits
Wallet and Ledger
Custodial balances
Deposit address generation
Withdrawal requests
Available vs locked balances
Double-entry ledger
Idempotent deposits and withdrawals
Audit-safe balance reconstruction
Trading
Trading pairs
Order placement
Limit orders
Market orders
Order cancellation
Matching engine
Partial fills
Maker/taker fees
Order book snapshots
Realtime and Events
WebSocket gateway
Live ticker updates
Order book updates
User balance updates
Kafka event system
BullMQ background jobs
Outbox pattern
Admin and Observability
Admin dashboard APIs
User search
KYC review queue
Withdrawal review queue
Audit logs
Structured logs
Request IDs
Health checks
Status
This backend is under active development.

Current focus:

Auth security
2FA
Trusted devices
Recent 2FA
User profile
KYC foundation
Next planned backend area:

Complete KYC admin review and document handling
