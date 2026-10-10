import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { LedgerDirection, WalletLedgerEntry } from '../../domain/ledger/wallet-ledger-entry';
import { Money } from '../../domain/money/money';
import {
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
  type FailureCode,
} from '../../domain/wagering/wager-transaction';
import { WalletLedgerEntryRepository } from '../../infrastructure/persistence/repositories/wallet-ledger-entry.repository';
import { WagerTransactionRepository } from '../../infrastructure/persistence/repositories/wager-transaction.repository';
import { WalletRepository } from '../../infrastructure/persistence/repositories/wallet.repository';

export interface ProcessWagerCommand {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  amount: string;
  currency: string;
}

export interface ProcessWagerResult {
  transactionId: string;
  externalTransactionId: string;
  status: WagerTransactionStatus;
  balance: { amount: string; currency: string };
  failureCode?: FailureCode;
  idempotentReplay: boolean;
}

export class WagerIdempotencyConflictError extends Error {
  constructor() {
    super('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH');
    this.name = 'WagerIdempotencyConflictError';
  }
}

function assertNonEmpty(value: string, name: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('INVALID_' + name);
  }
}

function canonicalHash(command: ProcessWagerCommand): string {
  const payload = [
    command.providerId,
    command.externalTransactionId,
    command.idempotencyKey,
    command.walletId,
    command.playerId,
    command.roundId,
    command.gameId,
    command.kind,
    command.amount,
    command.currency,
  ];
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

@Injectable()
export class ProcessWagerTransactionUseCase {
  constructor(
    private readonly em: EntityManager,
    private readonly wallets: WalletRepository,
    private readonly transactions: WagerTransactionRepository,
    private readonly ledger: WalletLedgerEntryRepository,
  ) {}

  async execute(command: ProcessWagerCommand): Promise<ProcessWagerResult> {
    for (const [name, value] of Object.entries({
      PROVIDER_ID: command.providerId,
      EXTERNAL_TRANSACTION_ID: command.externalTransactionId,
      IDEMPOTENCY_KEY: command.idempotencyKey,
      WALLET_ID: command.walletId,
      PLAYER_ID: command.playerId,
      ROUND_ID: command.roundId,
      GAME_ID: command.gameId,
    })) {
      assertNonEmpty(value, name);
    }

    if (![WagerTransactionKind.Bet, WagerTransactionKind.Win, WagerTransactionKind.Loss].includes(command.kind)) {
      throw new Error('UNSUPPORTED_TRANSACTION_KIND');
    }

    const money = Money.from({ amount: command.amount, currency: command.currency });
    if (!money.isPositive()) throw new Error('INVALID_TRANSACTION_AMOUNT');
    const hash = canonicalHash(command);

    return this.em.transactional(async (tx) => {
      // Transaction-scoped locks coordinate all API/worker instances.
      // A stable order prevents deadlocks between overlapping identities.
      const lockKeys = [
        'wager:idem:' + command.providerId + ':' + command.idempotencyKey,
        'wager:external:' + command.providerId + ':' + command.externalTransactionId,
      ].sort();

      for (const key of lockKeys) {
        await tx.getConnection().execute(
          'select pg_advisory_xact_lock(hashtextextended(?, 0))',
          [key],
        );
      }

      const byKey = await this.transactions.findByIdempotencyKey(
        command.providerId, command.idempotencyKey, tx,
      );
      const byExternalId = await this.transactions.findByExternalId(
        command.providerId, command.externalTransactionId, tx,
      );
      const previous = byKey ?? byExternalId;

      if (previous) {
        if (!previous.matchesPayload(hash)) throw new WagerIdempotencyConflictError();
        const snapshot = await this.transactions.findResponseSnapshot(previous.id, tx);
        if (!snapshot) throw new Error('MISSING_PERSISTED_RESPONSE_SNAPSHOT');
        return { ...snapshot, idempotentReplay: true };
      }

      const wallet = await this.wallets.findByIdForUpdate(command.walletId, tx);
      if (!wallet) throw new Error('WALLET_NOT_FOUND');
      if (wallet.playerId !== command.playerId) throw new Error('WALLET_PLAYER_MISMATCH');
      if (wallet.currency !== money.currency) throw new Error('CURRENCY_MISMATCH');

      const transaction = WagerTransaction.create({
        id: randomUUID(),
        providerId: command.providerId,
        externalTransactionId: command.externalTransactionId,
        idempotencyKey: command.idempotencyKey,
        payloadHash: hash,
        walletId: wallet.id,
        playerId: command.playerId,
        roundId: command.roundId,
        gameId: command.gameId,
        kind: command.kind,
        money,
      });

      const before = wallet.balance;
      let direction: LedgerDirection | undefined;

      if (command.kind === WagerTransactionKind.Bet) {
        if (wallet.balance.isLessThan(money)) {
          transaction.reject('INSUFFICIENT_FUNDS');
        } else {
          wallet.debit(money);
          direction = LedgerDirection.Debit;
        }
      } else if (command.kind === WagerTransactionKind.Win) {
        wallet.credit(money);
        direction = LedgerDirection.Credit;
      }

      if (transaction.status === WagerTransactionStatus.Pending) {
        transaction.markProcessed();
      }

      const result: ProcessWagerResult = {
        transactionId: transaction.id,
        externalTransactionId: transaction.externalTransactionId,
        status: transaction.status,
        balance: wallet.balance.toJSON(),
        ...(transaction.failureCode ? { failureCode: transaction.failureCode } : {}),
        idempotentReplay: false,
      };

      this.transactions.create(transaction, tx);
      await tx.flush();

      if (direction) {
        await this.wallets.update(wallet, tx);
        this.ledger.create(
          WalletLedgerEntry.create({
            id: randomUUID(),
            walletId: wallet.id,
            transactionId: transaction.id,
            direction,
            money,
            balanceBefore: before,
            balanceAfter: wallet.balance,
          }),
          tx,
        );
        await tx.flush();
      }

      await this.transactions.updateStatus(transaction, tx, result);
      return result;
    });
  }
}
