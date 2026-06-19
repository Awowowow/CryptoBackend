# CryptoEx Backend

CryptoEx is a production-style backend for a centralized crypto exchange. It includes authentication, 2FA, KYC, wallet accounting, custody-provider deposit and withdrawal flows, event-driven workers, Kafka-backed domain events, and a spot trading engine with order book and trade history APIs.

> Status: In progress. This project is built for learning, portfolio demonstration, and testnet/sandbox integrations. It is not production-ready for real funds without additional security, compliance, monitoring, and operational controls.

## Highlights

- Secure authentication with JWT, refresh tokens, HTTP-only cookies, session tracking, email verification, password reset, and trusted-device concepts.
- Google Authenticator TOTP 2FA with encrypted secrets and recent-2FA checks for sensitive actions.
- KYC submission and admin review workflows with document upload and audit logs.
- Wallet system using available and locked balances.
- Double-entry ledger for financial correctness across deposits, withdrawals, order locks, trade settlement, and fund unlocks.
- BitGo test custody integration for receive addresses, deposits, withdrawal submission, and webhook processing.
- BullMQ workers for async custody webhook and withdrawal processing.
- PostgreSQL outbox pattern with Kafka publishing for domain events.
- Spot trading system with trading pairs, limit orders, order matching, order cancellation, order book, recent trades, and private user trade history.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js, Express.js |
| Database | PostgreSQL, Prisma |
| Queue | Redis, BullMQ |
| Event Streaming | Kafka, KafkaJS |
| Custody / Blockchain | BitGo test API, BitGo Express, ethers.js |
| Auth / Security | JWT, HTTP-only cookies, bcrypt, TOTP, AES-256-GCM |
| Files | Multer |
| Mail | Nodemailer |
| Local Infra | Docker Compose |

## Architecture Overview

```txt
Client / Postman / Frontend
        |
        v
Express API
        |
        +--> Auth / 2FA / KYC
        |
        +--> Wallet + Ledger
        |       |
        |       +--> Deposits
        |       +--> Withdrawals
        |
        +--> Trading
        |       |
        |       +--> Orders
        |       +--> Matching Engine
        |       +--> Trades
        |       +--> Order Book
        |
        +--> Webhooks
                |
                v
          BullMQ Workers
                |
                v
          PostgreSQL + Redis
                |
                v
          Domain Event Outbox
                |
                v
              Kafka
```

## Core Domains

### Authentication

The authentication module handles account creation, login, refresh-token based sessions, logout, email verification, password reset, and protected route middleware.

Security-focused features include:

- Password hashing with bcrypt.
- Access and refresh tokens.
- HTTP-only cookie support.
- Refresh-token/session storage.
- Trusted-device model.
- Login attempt tracking.

### Two-Factor Authentication

The 2FA module supports Google Authenticator-style TOTP.

Implemented concepts:

- TOTP setup with QR code support.
- Encrypted 2FA secrets.
- Login-time 2FA verification.
- Recent-2FA verification for sensitive operations.
- Trusted-device listing and removal.

### KYC

The KYC module lets users submit identity details and documents, while admins can review, approve, or reject submissions.

KYC includes:

- User submission workflow.
- File upload support.
- Admin review routes.
- Rejection reasons.
- Audit logs for traceability.

### Wallet and Ledger

CryptoEx uses an internal wallet ledger instead of directly treating blockchain balances as user balances.

Wallet accounts are separated by type:

- `AVAILABLE`
- `LOCKED`
- `CUSTODY`
- `FEE_REVENUE`

Financial changes are recorded through double-entry ledger transactions. This helps prevent incorrect balance updates and creates a clear audit trail.

Ledger transaction examples:

- Deposit credit.
- Withdrawal fund lock.
- Withdrawal fund unlock.
- Trade order fund lock.
- Trade settlement.
- Fee collection.

### Custody, Deposits, and Webhooks

CryptoEx integrates with BitGo test custody for deposit addresses and transfer information.

Deposit flow:

```txt
User requests deposit address
-> CryptoEx asks BitGo for receive address
-> User sends testnet crypto
-> BitGo sends webhook
-> CryptoEx stores webhook event
-> BullMQ worker fetches official transfer details
-> Deposit is recorded idempotently
-> Ledger credits user balance
```

Webhook safety features:

- Signature verification.
- Replay protection.
- Payload validation.
- Inbox-style event storage.
- Idempotent processing.
- Async BullMQ worker processing.

### Withdrawals

Withdrawals use an async lifecycle.

High-level flow:

```txt
User requests withdrawal
-> Security and balance checks
-> Funds move from available to locked
-> Approved withdrawal is queued
-> Worker submits withdrawal to BitGo
-> Worker/finalizer checks transfer status
-> Ledger completes or unlocks funds depending on result
```

Withdrawal statuses include states such as requested, checked, funds locked, approved, submitted, broadcasted, completed, failed, and rejected.

### Trading

The trading system supports spot-style limit orders.

Implemented trading features:

- Trading pair setup, such as `ETH-USDT`.
- Limit buy/sell orders.
- Order fund locking.
- Matching engine.
- Trade recording.
- Double-entry trade settlement.
- Order cancellation.
- Public order book.
- Public recent trades.
- Private user trade history.

Trading flow:

```txt
User places order
-> Backend validates order
-> Required funds are locked
-> Matching engine checks opposite orders
-> If matched, trade is recorded
-> Ledger settles buyer/seller balances
-> Orders are marked OPEN, PARTIALLY_FILLED, FILLED, or CANCELLED
```

## Event-Driven Processing

CryptoEx uses multiple event-driven patterns:

### BullMQ

BullMQ handles task execution where exactly one worker should process a job.

Examples:

- Process custody webhook events.
- Submit approved withdrawals.
- Finalize withdrawal status.

### Outbox Pattern

Important domain events are first stored in PostgreSQL inside a `DomainEventOutbox` table. This avoids the dual-write problem where a database update succeeds but Kafka publishing fails.

Flow:

```txt
Business transaction commits
-> Outbox row is created
-> PostgreSQL NOTIFY wakes outbox worker
-> Worker publishes event to Kafka
-> Outbox row is marked PUBLISHED
```

### Kafka

Kafka is used as an event stream for domain events, starting with withdrawal events.

Example topic:

```txt
cryptoex.withdrawal.events
```

This makes the project ready for future independent consumers such as notifications, analytics, compliance monitoring, and audit pipelines.

## Project Structure

```txt
Backend/
  app.js
  config/
    prisma.js
    redis.js
  controllers/
  jobs/
  middleware/
  queues/
  router/
  scripts/
  services/
    blockchain-service/
    custody-service/
    trading-service/
    wallet-ledger-service/
  utils/
  validators/
  workers/
prisma/
  auth/
    schema.prisma
docker-compose.yml
docker-compose.kafka.yml
```

## Getting Started

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

Create `.env` in the project root.

Example:

```env
NODE_ENV=development
PORT=5050

DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:55432/crypto_auth?schema=public"

JWT_ACCESS_SECRET="replace_me"
JWT_REFRESH_SECRET="replace_me"

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

BITGO_ACCESS_TOKEN="replace_me"
BITGO_EXPRESS_URL="http://localhost:3080"
BITGO_ETH_TEST_COIN="hteth"
BITGO_ETH_WALLET_ID="replace_me"
BITGO_WEBHOOK_SECRET="replace_me"

KAFKA_BROKERS="localhost:9092"
KAFKA_CLIENT_ID="cryptoex-backend"
KAFKA_WITHDRAWAL_TOPIC="cryptoex.withdrawal.events"
```

Never commit real secrets to GitHub.

### 4. Run Prisma

```bash
npx prisma format --schema prisma/auth/schema.prisma
npx prisma validate --schema prisma/auth/schema.prisma
npx prisma migrate dev --schema prisma/auth/schema.prisma
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

Default API URL:

```txt
http://localhost:5050
```

### 7. Start workers

Custody webhook worker:

```bash
npm run worker:custody-webhooks
```

Withdrawal worker:

```bash
npm run worker:withdrawals
```

Domain event outbox worker:

```bash
npm run worker:outbox
```

## Useful API Areas

### Auth

```txt
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
```

### 2FA

```txt
POST /2fa/setup
POST /2fa/verify-setup
POST /2fa/verify-login
POST /2fa/verify-recent
GET  /2fa/trusted-devices
```

### KYC

```txt
POST /kyc
GET  /kyc
```

Admin KYC routes are available under the admin router.

### Wallet

```txt
GET  /wallet/balances
GET  /wallet/deposits
GET  /wallet/deposit-address/:assetSymbol
POST /wallet/withdrawals
GET  /wallet/withdrawals
GET  /wallet/withdrawals/:withdrawalId
```

### Trading

```txt
GET  /trading/pairs
GET  /trading/order-book?symbol=ETH-USDT
GET  /trading/recent-trades?symbol=ETH-USDT
GET  /trading/my-trades
GET  /trading/orders
POST /trading/orders
POST /trading/orders/:orderId/cancel
```

### Webhooks

```txt
POST /webhooks/custody/bitgo
```

## Example Trading Test

Create a buy order with User A:

```json
{
  "symbol": "ETH-USDT",
  "side": "BUY",
  "type": "LIMIT",
  "price": "2500",
  "quantity": "0.001"
}
```

Create a matching sell order with User B:

```json
{
  "symbol": "ETH-USDT",
  "side": "SELL",
  "type": "LIMIT",
  "price": "2500",
  "quantity": "0.001"
}
```

Then check:

```txt
GET /trading/order-book?symbol=ETH-USDT
GET /trading/recent-trades?symbol=ETH-USDT
GET /trading/my-trades
GET /wallet/balances
```

## What This Project Demonstrates

- Secure authentication and 2FA design.
- Custodial crypto exchange architecture.
- Financial ledger modeling.
- Idempotent deposit and withdrawal processing.
- Webhook security and async processing.
- Queue-based workers.
- Outbox pattern and Kafka event publishing.
- Spot order matching and trade settlement.
- Separation of controllers, services, routers, middleware, jobs, queues, and workers.

## Roadmap

- Add richer market summary endpoint.
- Add candlestick/OHLCV generation.
- Add WebSocket market data streams.
- Add admin risk review for withdrawals and suspicious activity.
- Add trading fees and fee revenue accounting.
- Add reconciliation jobs for stuck withdrawals and custody-provider drift.
- Add automated tests for ledger, matching, deposits, withdrawals, and webhook security.
- Add observability: structured logs, metrics, alerts, and tracing.

## Disclaimer

This project is a backend learning and portfolio project. It uses testnet/sandbox flows and should not be used with real customer funds without professional security review, compliance review, production custody controls, incident response procedures, monitoring, and audited financial operations.
