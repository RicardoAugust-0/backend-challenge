# Architecture — Distributed Wagering Processor

> Status: initial architecture decision record. Implementation and measured tests are pending. This document must be updated with actual trade-offs and commands before submission.

## Goals and boundaries

Prioritize financial correctness, persistent idempotency, multi-instance concurrency, and recovery from at-least-once delivery. Domain classes contain no NestJS or ORM dependencies. HTTP and SQS share one application use case.

## Stack

- Bun 1.x, TypeScript strict, NestJS.
- PostgreSQL, MikroORM and versioned reversible migrations.
- AWS SQS FIFO and DLQ through LocalStack for local tests.
- Docker Compose for API, worker, PostgreSQL and LocalStack.

## Modules

- `domain/money`: immutable decimal string money, ISO currency validation, exact 2-decimal scale, no JS numbers for monetary arithmetic.
- `domain/wallet`: encapsulated balance and version, debit/credit invariants.
- `domain/wagering`: transaction state machine and reference rules; terminal status cannot transition.
- `domain/ledger`: immutable one-entry-per-wallet-and-transaction financial movements, exact before/after arithmetic.
- `application`: shared submit transaction use case, reconciliation and queries, transaction boundaries.
- `infrastructure/persistence`: MikroORM mappings, repositories, migrations, transaction-scoped entity managers and constraints.
- `infrastructure/messaging`: SQS consumer, inbox, transactional outbox publisher, reference retry worker.
- `interfaces/http`: DTOs, controllers, exception filters, health checks.

## Financial representation

Represent money using an immutable arbitrary-precision decimal library. Accept and serialize only strings formatted as a decimal with exactly two fractional digits. Never convert monetary values to a JavaScript `number`. PostgreSQL uses `NUMERIC(20,2)` and string mapping. Reject negatives on inbound financial operations. Currency mismatch raises a domain error.

## Persistence invariants

Enforce at the database level: unique wallet by `(player_id, currency)`; `balance >= 0`; unique transaction by `(provider_id, external_transaction_id)` and idempotency namespace; unique ledger by `(wallet_id, transaction_id)`; immutable ledger rows (restrict UPDATE/DELETE via database trigger and permissions); positive transaction amounts; well-defined terminal statuses and foreign keys. The exact migrations must implement these safeguards.

Wallet creation with a positive opening balance inserts the wallet, internal OPENING transaction and CREDIT ledger entry in one SQL transaction. Starting version is 1. Balance version increases only for actual balance changes.

## Concurrency and idempotency

Use a PostgreSQL row-level lock (`SELECT ... FOR UPDATE`) on the specific wallet while applying an operation. Do not take global locks. Inside one SQL transaction, atomically reserve/check the persistent idempotency identity, validate canonical JSON payload hash, apply domain rules, persist new wallet balance/version, transaction record, immutable ledger row and outbox event(s), and inbox entry when the origin is SQS.

Concurrent requests with the same key must resolve to a single persisted operation, not duplicate money movement. Retrying a completed request returns its persisted original response snapshot, including historical balance, with `idempotentReplay: true`. Same idempotency key with different canonical business payload produces conflict. Enforce uniqueness in PostgreSQL, not in memory. Define a deterministic key lock ordering if multiple rows are locked.

For the required initial 100.00 BRL with two concurrent BETs of 80.00 BRL, exactly one must process, one must reject, the wallet must end at 20.00 and the ledger must contain exactly one debit. Test with concurrent processes and real PostgreSQL.

## References and state transitions

BET debits; WIN credits; LOSS records without balance movement; REFUND credits a processed BET exactly once; ROLLBACK reverses a processed BET, WIN or REFUND exactly once, with no partial reversal. References must match provider, player, wallet, currency and round. Separate failure codes for insufficient funds on BET and negative balance due to reversal. An unavailable reference remains PENDING_REFERENCE and is retried by a scheduled worker with bounded exponential backoff and eventual auditable rejection.

Define explicit legal state transitions: PENDING -> PROCESSED / PENDING_REFERENCE / REJECTED / FAILED; PENDING_REFERENCE -> PROCESSED / REJECTED / FAILED. Terminal PROCESSED, REJECTED and FAILED never transition.

## SQS / inbox / outbox

HTTP and FIFO SQS consumer call the same transaction-processing use case. Persist inbox by `(consumer_name, message_id)` in the same SQL commit. Acknowledge SQS only after commit. Business rejection is terminal and acknowledged; transient failures are retried; exhausted/permanent failures go to DLQ. SIGTERM drains in-flight work or safely permits re-delivery.

Outbox events are written in the *same commit* as the financial records. Multiple publishers claim pending rows with `FOR UPDATE SKIP LOCKED` (short claim transaction), publish and mark delivered, retry with bounded backoff. Publishing can occur more than once after a crash; consumers must deduplicate by stable eventId. Never publish from inside an uncommitted financial transaction.

## HTTP and authentication

Implement all endpoints specified in the challenge, including wallet, ledger cursor pagination, transaction queries, reconciliation and separate liveness/readiness. Map validation, idempotency conflicts, business rejections, pending processing and infrastructure errors to distinct documented responses. Health checks are public.

Authentication is intentionally deferred to protect the scoring timebox: provide an explicit no-op guard / provider identity interface, document production integration with an external OIDC provider (Keycloak or equivalent). This is permitted by challenge section 2; it is not production authentication.

## Observability

Structured JSON logs with correlation and entity identifiers, never full financial payloads. Metrics for transaction status, duplicates, retries, DLQ, lock contention, outbox lag and duration. Health readiness checks PostgreSQL and SQS connectivity.

## Verification plan

Use Bun unit tests for Money, Wallet and all wager types. Use real PostgreSQL and LocalStack containers for migrations, commit atomicity, inbox redelivery, outbox failover, retry/DLQ and restart behavior. Concurrency tests must include 50 duplicate BETs in parallel, two 80.00 BETs against 100.00, different wallets, at least three application processes, crash after commit before ack, two outbox publishers and out-of-order reversal. After each test, assert materialized wallet balance equals reconstructed ledger.

## Open decisions

- Select the exact decimal implementation and ISO-4217 currency policy.
- Decide outbox event delivery queue separation and publisher batch size.
- Specify pending-reference TTL/attempt cap and retry schedule.
- Decide response snapshot schema and stable error taxonomy.
- Validate all lock ordering and transaction isolation choices through actual containerized stress tests.

Nothing in this document claims tests have passed or the implementation is complete.
