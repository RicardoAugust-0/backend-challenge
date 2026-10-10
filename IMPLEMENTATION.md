# Implementation status — Wagering backend

This document tracks what is actually implemented and verified. The root README is the original technical challenge, not a statement that all requirements are complete.

## Current implementation

- Strict domain objects: `Money`, `Wallet`, `WagerTransaction` and immutable `WalletLedgerEntry`.
- MikroORM/PostgreSQL schema, migrations and checks for nonnegative balances, positive movements and consistent ledger arithmetic.
- A PostgreSQL trigger prevents ledger UPDATE/DELETE.
- `OpenWalletUseCase` inserts a wallet, an internal OPENING transaction and the opening CREDIT entry in a single SQL transaction (or no opening entry for a zero balance).
- `ProcessWagerTransactionUseCase` implements BET, WIN and LOSS with an atomic database transaction.
- Transaction-scoped advisory locks serialize overlapping provider identities. Wallet row locks and version checks protect concurrent balance changes.
- Duplicate requests replay a persisted response snapshot, rather than returning a newly calculated balance.
- HTTP endpoints for wallet creation/lookup, transaction submission/lookup, cursor ledger history and on-demand reconciliation.
- PostgreSQL integration tests cover two concurrent 80.00 BETs, 50 duplicate BET requests, conflicting payloads, historical replay, rollback on injected failure and ledger immutability.

## Running locally

Prerequisites: Bun 1.4.x, Node.js (for Jest), Docker Engine with Compose and PostgreSQL port 5432 available.

```sh
bun install --frozen-lockfile
cp .env.example .env
# Fill in DATABASE_* values in .env (see docker-compose.yml).
docker compose up -d postgres
bunx mikro-orm migration:up
bunx tsc --noEmit
bun test src/domain
RUN_DB_TESTS=1 bun test src/application
RUN_DB_TESTS=1 node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand
bun run build
```

For development, start the NestJS HTTP service with `bun run start:dev`. Do not use the API against production funds.

## HTTP interface (implemented)

- `POST /wallets` — `{ "playerId": "...", "initialBalance": {"amount":"100.00","currency":"BRL"} }`
- `GET /wallets/:walletId`
- `GET /wallets/:walletId/ledger?limit=50&cursor=...`
- `POST /wallets/:walletId/reconciliation`
- `POST /wagering/transactions` — requires `Idempotency-Key` header; business fields match the challenge README (currently BET/WIN/LOSS only)
- `GET /wagering/transactions/:transactionId`
- `GET /providers/:providerId/wagering/transactions/:externalTransactionId`

A domain-level rejection such as insufficient balance persists a REJECTED transaction and returns HTTP 422. Conflicting idempotency identities return 409. Invalid requests return 400.

## Important limits and work remaining

**Do not treat this version as a production-grade wagering processor.** The following challenge requirements remain unimplemented or need validation:

- REFUND and ROLLBACK, with reference validity, out-of-order delivery, retry and duplicate-reversal protection.
- SQS FIFO, LocalStack, transactional inbox/outbox, DLQ, message acknowledgements and restart/retry scenarios.
- Full authentication/provider-identity enforcement. The current HTTP endpoints are **not authenticated**.
- Live/readiness endpoints and structured metrics/logging.
- Multi-process concurrency, crash recovery, failure-injection around message acknowledgement and publisher leader competition.
- Database-level immutable transaction identity and exhaustive status/foreign-key constraints.
- Deployment-grade Docker Compose setup for API, worker, PostgreSQL and LocalStack.
- A separate security review and performance measurements.

All production integration must wait for these requirements to be completed and verified.

## Engineering notes

- Monetary input and output uses decimal strings. JavaScript floating-point numbers are not used for monetary calculations.
- The balance is a materialized projection; ledger entries are the audit trail.
- Lock ordering is deterministic within each financial operation. PostgreSQL unique indexes remain the final idempotency guarantee.
- Never edit an already-applied migration. Add an incremental migration instead.
- The GitHub Actions workflow is the authoritative verification for this branch; check the latest completed run before merging.
