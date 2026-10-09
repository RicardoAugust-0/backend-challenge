import { describe, expect, it } from 'bun:test';
import { Money } from '../money/money';
import { LedgerDirection, WalletLedgerEntry } from './wallet-ledger-entry';

const money = (amount: string): Money =>
  Money.from({ amount, currency: 'BRL' });

describe('WalletLedgerEntry', () => {
  it('should create a valid debit entry', () => {
    const entry = WalletLedgerEntry.create({
      id: 'ledger-1',
      walletId: 'wallet-1',
      transactionId: 'transaction-1',
      direction: LedgerDirection.Debit,
      money: money('30.00'),
      balanceBefore: money('100.00'),
      balanceAfter: money('70.00'),
    });

    expect(entry.isBalanced()).toBe(true);
    expect(entry.direction).toBe(LedgerDirection.Debit);
  });

  it('should create a valid credit entry', () => {
    const entry = WalletLedgerEntry.create({
      id: 'ledger-2',
      walletId: 'wallet-1',
      transactionId: 'transaction-2',
      direction: LedgerDirection.Credit,
      money: money('50.00'),
      balanceBefore: money('70.00'),
      balanceAfter: money('120.00'),
    });

    expect(entry.isBalanced()).toBe(true);
  });

  it('should reject an inconsistent debit', () => {
    expect(() =>
      WalletLedgerEntry.create({
        id: 'ledger-3',
        walletId: 'wallet-1',
        transactionId: 'transaction-3',
        direction: LedgerDirection.Debit,
        money: money('30.00'),
        balanceBefore: money('100.00'),
        balanceAfter: money('60.00'),
      }),
    ).toThrow('UNBALANCED_LEDGER_ENTRY');
  });

  it('should reject zero amount', () => {
    expect(() =>
      WalletLedgerEntry.create({
        id: 'ledger-4',
        walletId: 'wallet-1',
        transactionId: 'transaction-4',
        direction: LedgerDirection.Credit,
        money: money('0.00'),
        balanceBefore: money('100.00'),
        balanceAfter: money('100.00'),
      }),
    ).toThrow('INVALID_LEDGER_AMOUNT');
  });

  it('should reject a debit producing negative balance', () => {
    expect(() =>
      WalletLedgerEntry.create({
        id: 'ledger-5',
        walletId: 'wallet-1',
        transactionId: 'transaction-5',
        direction: LedgerDirection.Debit,
        money: money('80.00'),
        balanceBefore: money('50.00'),
        balanceAfter: money('0.00'),
      }),
    ).toThrow('UNBALANCED_LEDGER_ENTRY');
  });

  it('should preserve the original timestamp', () => {
    const createdAt = new Date('2026-10-09T12:00:00.000Z');

    const entry = WalletLedgerEntry.create({
      id: 'ledger-6',
      walletId: 'wallet-1',
      transactionId: 'transaction-6',
      direction: LedgerDirection.Credit,
      money: money('10.00'),
      balanceBefore: money('0.00'),
      balanceAfter: money('10.00'),
      createdAt,
    });

    entry.createdAt.setFullYear(2030);

    expect(entry.createdAt.toISOString()).toBe('2026-10-09T12:00:00.000Z');
  });
});
