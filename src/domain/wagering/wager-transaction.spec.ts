import { describe, expect, it } from 'bun:test';
import { Money } from '../money/money';
import {
  InvalidTransactionStateError,
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from './wager-transaction';

const createTransaction = (
  kind = WagerTransactionKind.Bet,
  referenceExternalTransactionId?: string,
) =>
  WagerTransaction.create({
    id: 'transaction-1',
    providerId: 'provider-a',
    externalTransactionId: 'external-1',
    idempotencyKey: 'provider-a:external-1',
    payloadHash: 'hash-123',
    walletId: 'wallet-1',
    playerId: 'player-1',
    roundId: 'round-1',
    gameId: 'game-1',
    kind,
    money: Money.from({
      amount: '30.00',
      currency: 'BRL',
    }),
    referenceExternalTransactionId,
  });

describe('WagerTransaction', () => {
  it('should start pending', () => {
    const tx = createTransaction();

    expect(tx.status).toBe(WagerTransactionStatus.Pending);
    expect(tx.isTerminal()).toBe(false);
  });

  it('should process a transaction', () => {
    const tx = createTransaction();

    tx.markProcessed();

    expect(tx.status).toBe(WagerTransactionStatus.Processed);
    expect(tx.isTerminal()).toBe(true);
  });

  it('should prevent changing a terminal transaction', () => {
    const tx = createTransaction();
    tx.markProcessed();

    expect(() => tx.reject('INSUFFICIENT_FUNDS')).toThrow(
      InvalidTransactionStateError,
    );
  });

  it('should require a reference for refund', () => {
    expect(() => createTransaction(WagerTransactionKind.Refund)).toThrow(
      'REFERENCE_REQUIRED',
    );
  });

  it('should allow pending reference', () => {
    const tx = createTransaction(
      WagerTransactionKind.Rollback,
      'external-original',
    );

    tx.markPendingReference();

    expect(tx.status).toBe(WagerTransactionStatus.PendingReference);
  });

  it('should detect matching payload hash', () => {
    const tx = createTransaction();

    expect(tx.matchesPayload('hash-123')).toBe(true);
    expect(tx.matchesPayload('different-hash')).toBe(false);
  });

  it('should reject external opening transactions', () => {
    expect(() => createTransaction(WagerTransactionKind.Opening)).toThrow(
      'OPENING_IS_INTERNAL',
    );
  });
});
