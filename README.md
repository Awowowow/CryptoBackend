# CryptoEx Backend

CryptoEx is a production-style backend for a centralized crypto exchange. It models the core systems behind an exchange: secure authentication, KYC, custody wallets, deposits, withdrawals, double-entry ledger accounting, spot trading, market data pipelines, fiat test deposits, event-driven workers, and deployment automation.

> Status: Live portfolio project using testnet and sandbox integrations. CryptoEx is built for learning, system-design practice, and demonstration. It is not intended for real customer funds without professional security review, compliance review, monitoring, incident response, and audited operational controls.

## Live Project

- Frontend: [https://cryptoex.me](https://cryptoex.me)
- API: [https://api.cryptoex.me](https://api.cryptoex.me)
- Frontend app repo: React, Redux Toolkit, Tailwind CSS, Vite
- Backend repo: Node.js, Express, PostgreSQL, Prisma, Redis, BullMQ, Kafka, BitGo, Razorpay

## What CryptoEx Demonstrates

- A centralized exchange architecture with internal balances instead of direct user blockchain balances.
- Secure account flows with JWT rotation, Redis-backed sessions, email verification, password reset, 2FA, trusted devices, and RBAC.
- KYC submission and admin review workflows with document uploads and audit logging.
- Wallet accounting with available, locked, custody, and fee revenue accounts.
- Double-entry ledger transactions for deposits, withdrawals, order locks, trade settlement, unlocks, and admin adjustments.
- BitGo custody integration for BTC testnet and ETH Hoodi receive addresses, deposits, withdrawals, webhooks, confirmation tracking, and reconciliation.
- Razorpay test-mode fiat deposits that credit test USDT after checkout signature verification.
- A spot trading engine with trading pairs, limit orders, price-time priority, partial fills, order cancellation, public order books, recent trades, and private trade history.
- Binance reference market data streamed through WebSockets, Kafka, Redis, and PostgreSQL projections for tickers and OHLCV candles.
- Event-driven processing with BullMQ workers, Kafka, and a PostgreSQL transactional outbox.
- Distributed rate limiting with sliding-window counters for sensitive actions and token buckets for high-volume read APIs.
- CI/CD with GitHub Actions, Prisma validation/migrations, PM2 worker restarts, and production smoke tests.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js, Express.js |
| Database | PostgreSQL, Prisma |
| Cache / Sessions | Redis |
| Queues | BullMQ |
| Event Streaming | Kafka, KafkaJS |
| Custody | BitGo test APIs |
| Fiat Test Payments | Razorpay Checkout test mode |
| Market Data | Binance WebSocket streams |
| Blockchain | ethers.js, BitGo Express |
| Auth / Security | JWT, HTTP-only cookies, bcrypt, TOTP, AES-256-GCM, HMAC |
| Files | Multer |
| Mail | Nodemailer |
| Deployment | AWS EC2, NGINX, PM2, Docker, GitHub Actions |

## High-Level Architecture

```txt
Browser / Postman / Frontend
        |
        v
Express API
        |
        +--> Auth, sessions, 2FA, KYC, admin
        |
        +--> Wallet + double-entry ledger
        |       |
        |       +--> deposits
        |       +--> withdrawals
        |       +--> fiat test deposits
        |
        +--> Trading
        |       |
        |       +--> order creation
        |       +--> fund locking
        |       +--> matching engine
        |       +--> trade settlement
        |
        +--> Public market APIs
        |
        +--> Webhook inbox
                |
                v
             BullMQ
                |
                v
Workers: custody, withdrawals, outbox, candles, market projection
                |
                v
PostgreSQL + Redis + Kafka
```

## Core Domains

### Authentication and Session Security

CryptoEx uses short-lived access tokens and longer-lived refresh tokens. Sessions are tracked in Redis so the backend can rotate, invalidate, and revoke sessions without waiting for token expiry.

Implemented controls:

- User registration and login.
- Password hashing with bcrypt.
- JWT access and refresh tokens.
- HTTP-only cookie support.
- Refresh-token rotation.
- Redis-backed session storage.
- Email verification.
- Password reset tokens.
- Role-based access control for admin routes.
- Trusted-device support for 2FA login flows.

### Two-Factor Authentication

CryptoEx supports Google Authenticator-style TOTP.

Implemented controls:

- 2FA setup QR code.
- AES-256-GCM encrypted 2FA secrets.
- Login-time OTP challenge.
- Recent 2FA step-up verification for sensitive operations.
- Trusted-device listing and revocation.
- OTP attempt rate limiting.

### KYC and Admin Review

Users can submit identity information and upload documents. Admin users can review submissions, approve or reject them, and record rejection reasons.

Implemented concepts:

- KYC status lifecycle.
- Document upload with Multer.
- Admin review routes.
- Immutable audit-style review events.
- Separation between user KYC routes and admin KYC routes.

### Wallets and Double-Entry Ledger

CryptoEx does not treat a blockchain wallet balance as a user's direct balance. Instead, it uses internal wallet accounts and ledger entries.

Wallet account types:

- `AVAILABLE`: spendable user balance.
- `LOCKED`: funds reserved for withdrawals or open orders.
- `CUSTODY`: system-side account representing custody movement.
- `FEE_REVENUE`: system account for collected fees.

Double-entry accounting means every financial movement has matching debit and credit entries. This makes balances explainable and auditable.

Examples:

- Deposit credited: custody/system account moves value into user available account.
- Withdrawal requested: user available moves to user locked.
- Withdrawal fails: user locked moves back to user available.
- Buy order placed: quote asset moves from available to locked.
- Trade settles: buyer receives base, seller receives quote, locked funds are reduced.

### Custody, Deposits, and Webhooks

CryptoEx integrates with BitGo test custody for BTC testnet and ETH Hoodi flows.

Deposit flow:

```txt
User requests deposit address
-> CryptoEx creates or fetches BitGo receive address
-> User sends testnet crypto
-> BitGo sends webhook to /webhooks/custody/bitgo
-> CryptoEx stores webhook event
-> BullMQ worker fetches official BitGo transfer details
-> Deposit row is created or updated idempotently
-> Confirmation status is finalized
-> Ledger credits user balance when required confirmations are reached
```

Webhook safety:

- Raw body capture through Express JSON verify hook.
- HMAC-style webhook signature middleware.
- Replay protection.
- Payload validation.
- Inbox-style `CustodyWebhookEvent` table.
- Idempotent transfer processing.
- Recovery logic for deposits that were detected but not finalized.

### Withdrawals

Withdrawals are handled asynchronously because blockchain and custody operations can take time.

Withdrawal flow:

```txt
User creates withdrawal
-> Authentication and recent security checks run
-> Available funds are locked
-> Withdrawal is reviewed / approved
-> BullMQ worker submits transfer to BitGo
-> Worker checks provider status
-> Funds are completed or unlocked depending on final state
```

The system records lifecycle states such as requested, security checked, funds locked, approved, processing, submitted, broadcasted, confirmed, completed, failed, rejected, and cancelled.

### Fiat Test Deposits With Razorpay

CryptoEx includes Razorpay test-mode deposits for adding test USDT.

Flow:

```txt
User creates Razorpay order
-> Backend creates FiatDeposit row
-> Razorpay Checkout collects test payment details
-> Frontend sends orderId, paymentId, signature
-> Backend verifies HMAC signature with Razorpay secret
-> FiatDeposit is marked captured / credited
-> Ledger credits USDT available balance
```

This is sandbox/test-mode only. It does not process real payments in the demo environment.

### Spot Trading

CryptoEx supports spot-style limit trading.

Implemented features:

- Trading pairs such as `BTC-USDT`, `ETH-USDT`, `SOL-USDT`, and other USDT pairs.
- Limit buy and sell orders.
- Available-to-locked fund movement when placing orders.
- Price-time priority matching.
- Partial fills.
- Trade records.
- Order status lifecycle: open, partially filled, filled, cancelled, rejected, expired.
- Public order book.
- Public recent trades.
- Private order and trade history.

Matching overview:

```txt
Buy order arrives
-> Find lowest-priced sell orders at or below buy price
-> Match oldest valid orders first at maker price
-> Create trade rows
-> Settle buyer and seller balances through ledger entries
-> Update remaining quantities and statuses
```

```txt
Sell order arrives
-> Find highest-priced buy orders at or above sell price
-> Match oldest valid orders first at maker price
-> Create trade rows
-> Settle buyer and seller balances through ledger entries
-> Update remaining quantities and statuses
```

### Market Data Pipeline

CryptoEx uses Binance as a reference market data source for live market movement.

Pipeline:

```txt
Binance WebSocket stream
-> Market data worker
-> Kafka market events
-> Market projection worker
-> Redis ticker cache + PostgreSQL candle projection
-> /market and /trading/candles APIs
```

Supported market data concepts:

- 24h ticker projections.
- OHLCV candles.
- Historical candle backfill.
- Reference-market candles.
- Exchange-trade candles from internal trades.
- Market overview endpoint for frontend discovery.

### Event-Driven Processing

CryptoEx uses multiple event patterns because different tasks need different guarantees.

BullMQ is used for jobs that should be retried and processed by workers:

- Custody webhook processing.
- Withdrawal submission.
- Deposit finalization recovery.

Kafka is used for event streams:

- Trade executed events.
- Withdrawal domain events.
- Market ticker and candle events.

The transactional outbox pattern is used to avoid the dual-write problem:

```txt
Business transaction commits in PostgreSQL
-> Outbox row is created in the same transaction
-> Outbox worker reads pending event
-> Worker publishes to Kafka
-> Outbox row is marked PUBLISHED
```

### Rate Limiting

CryptoEx uses two Redis-backed rate limiting styles.

Sliding-window counter:

- Best for sensitive actions.
- Smooths fixed-window bursts.
- Used for login, signup, password reset, 2FA, KYC, deposit address creation, withdrawals, and admin actions.

Token bucket:

- Best for high-volume read APIs.
- Allows short bursts while enforcing a refill rate.
- Used for market and trading read APIs.

Both implementations use Redis Lua scripts so each rate-limit decision is atomic.

## API Areas

### Auth

```txt
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/forgot-password
POST /auth/reset-password
```

### 2FA

```txt
POST   /2fa/verify-login
POST   /2fa/setup
POST   /2fa/verify-setup
POST   /2fa/verify-recent
GET    /2fa/trusted-devices
DELETE /2fa/trusted-devices/:trustedDeviceId
```

### KYC

```txt
GET  /kyc
POST /kyc
```

### Admin

```txt
GET   /admin/kyc/submissions
GET   /admin/kyc/submissions/:submissionId
PATCH /admin/kyc/submissions/:submissionId/review
```

### Wallet

```txt
GET  /wallet/balances
GET  /wallet/deposits
GET  /wallet/deposit-address/:assetSymbol?networkCode=ETH_HOODI
GET  /wallet/withdrawals
GET  /wallet/withdrawals/:withdrawalId
POST /wallet/withdrawals
```

### Payments

```txt
POST /payments/razorpay/orders
POST /payments/razorpay/verify
GET  /payments/deposits
```

### Trading

```txt
GET  /trading/pairs
GET  /trading/order-book?symbol=ETH-USDT
GET  /trading/recent-trades?symbol=ETH-USDT
GET  /trading/market-summary?symbol=ETH-USDT
GET  /trading/candles?symbol=ETH-USDT&interval=1m&range=24h
GET  /trading/orders
GET  /trading/my-trades
POST /trading/orders
POST /trading/orders/:orderId/cancel
```

### Market

```txt
GET /market/overview
```

### Blockchain

```txt
GET  /blockchain/health
POST /blockchain/scan/native-eth
```

### Webhooks

```txt
POST /webhooks/custody/bitgo
```

## Project Structure

```txt
Backend/
  app.js
  config/
  controllers/
  jobs/
  middleware/
    rate-limiters/
    slidingWindowCounter.js
    tokenBucket.js
  queues/
  router/
  scripts/
  services/
    auth-service/
    blockchain-service/
    custody-service/
    event-service/
    market-data-service/
    payment-service/
    trading-service/
    twofa-service/
    user-kyc-service/
    wallet-ledger-service/
  utils/
  validators/
  workers/
prisma/
  auth/
    schema.prisma
.github/
  workflows/
    ci.yml
docker-compose.yml
docker-compose.kafka.yml
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start local infrastructure

PostgreSQL and Redis:

```bash
docker compose up -d
```

Kafka and Kafka UI:

```bash
docker compose -f docker-compose.kafka.yml up -d
```

Kafka UI:

```txt
http://localhost:8085
```

### 3. Configure environment variables

Create `.env` in the project root. Keep real secrets out of Git.

```env
NODE_ENV=development
PORT=5050

DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:55432/crypto_auth?schema=public"

JWT_ACCESS_SECRET="replace_me"
JWT_REFRESH_SECRET="replace_me"

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

KAFKA_BROKERS="localhost:9092"
KAFKA_CLIENT_ID="cryptoex-backend"
KAFKA_TRADE_TOPIC="cryptoex.trade.events"
KAFKA_MARKET_TOPIC="cryptoex.market.events"

BITGO_ACCESS_TOKEN="replace_me"
BITGO_EXPRESS_URL="http://localhost:3080"
BITGO_WEBHOOK_SECRET="replace_me"
BITGO_HTETH_WALLET_ID="replace_me"
BITGO_TBTC_WALLET_ID="replace_me"

RAZORPAY_KEY_ID="rzp_test_xxx"
RAZORPAY_KEY_SECRET="replace_me"

MARKET_DATA_SYMBOLS="BTC-USDT,ETH-USDT,SOL-USDT,BNB-USDT,XRP-USDT,ADA-USDT,DOGE-USDT,TRX-USDT,LINK-USDT,BCH-USDT"
```

### 4. Run Prisma

```bash
npx prisma format --schema prisma/auth/schema.prisma
npx prisma validate --schema prisma/auth/schema.prisma
npx prisma migrate dev --schema prisma/auth/schema.prisma
npx prisma generate --schema prisma/auth/schema.prisma
```

### 5. Seed base data

```bash
node Backend/scripts/seed-asset.js
node Backend/scripts/seed-networks.js
node Backend/scripts/seed-trading-pairs.js
```

### 6. Start the API

```bash
npm run dev
```

Default local API URL:

```txt
http://localhost:5050
```

### 7. Start workers

Run each worker in a separate terminal:

```bash
npm run worker:custody-webhooks
npm run worker:withdrawals
npm run worker:outbox
npm run worker:trade-candles
npm run worker:market-data
npm run worker:market-projection
```

### 8. Backfill market candles

```bash
npm run backfill:market-candles
```

## Deployment

Production is deployed with:

- AWS EC2 for the backend API and worker processes.
- NGINX as reverse proxy.
- PM2 for process management.
- Docker for PostgreSQL, Redis, Kafka, and Kafka UI.
- GitHub Actions for CI/CD.
- Prisma migrations during deployment.
- Smoke tests after deployment.

Main production processes:

```txt
cryptoex-api
custody-webhooks-worker
withdrawals-worker
domain-events-worker
trade-candles-worker
market-data-worker
market-projection-worker
```

## CI/CD

The backend workflow validates and deploys the project:

- Installs dependencies with `npm ci`.
- Validates the Prisma schema.
- Generates the Prisma client.
- Runs JavaScript syntax checks.
- Pulls the latest code on EC2.
- Runs Prisma migration status and deploy.
- Restarts all PM2 API and worker processes.
- Runs local and public smoke tests.

Required GitHub secrets:

```txt
EC2_HOST
EC2_USER
EC2_SSH_KEY
```

## Measured Local Benchmarks

These are local development benchmarks, not guaranteed production capacity numbers.

| Area | Load | Result |
| --- | --- | --- |
| Trading order creation | 30 limit orders, concurrency 3 | Warm runs around 150 orders/sec, p99 around 40ms |
| Wallet balances | 5 req/sec for 20s | Avg 17.24ms, p50 11ms, p99 122ms |
| Order book | 5 req/sec for 20s | Avg 7.88ms, p50 5ms, p99 47ms |
| Recent trades | 5 req/sec for 20s | Avg 9.77ms, p50 5ms, p99 57ms |
| Market overview | 5 req/sec for 20s | Avg 203-490ms depending on cache/API state |
| Token bucket rate limit stress | 20 connections for 15s | Around 16.9k req/sec handled while rejecting excess traffic |
| Blockchain health | 5 req/sec for 20s | Avg around 541ms, p99 around 1.96s |

## Production Hardening Still Planned

CryptoEx already models many production-grade patterns, but these areas are intentionally marked as future hardening:

- Client-facing WebSocket gateway for live order book, trades, balances, and private order updates.
- Explicit high-concurrency database locking strategy for hot wallet/order rows using row locks, serializable isolation, or optimistic concurrency where appropriate.
- Larger automated test suite for ledger invariants, matching edge cases, custody webhooks, fiat deposits, and withdrawal failures.
- Centralized observability with metrics, alerts, structured logs, and traces.
- Staging environment before production deployment.
- Security review before any real-money usage.

## Disclaimer

CryptoEx is a learning and portfolio project using testnet/sandbox integrations. Real exchanges require licensed compliance operations, custody controls, penetration testing, financial audits, monitoring, incident response, and legal review before handling real users or real funds.
