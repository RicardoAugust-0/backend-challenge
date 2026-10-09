import { describe, expect, it } from 'bun:test';
import { Money } from '../money/money';
import { Wallet } from './wallet';

describe('Wallet', () => {
  const createWallet = () =>
    Wallet.open({
      id: 'wallet-123',
      playerId: 'player-123',
      initialBalance: Money.from({
        amount: '100.00',
        currency: 'BRL',
      }),
    });

  it('should open wallet with initial balance', () => {
    const wallet = createWallet();

    expect(wallet.balance.toJSON().amount).toBe('100.00');
    expect(wallet.version).toBe(1);
  });

  it('should debit successfully', () => {
    const wallet = createWallet();

    wallet.debit(
      Money.from({
        amount: '30.00',
        currency: 'BRL',
      }),
    );

    expect(wallet.balance.toJSON().amount).toBe('70.00');
    expect(wallet.version).toBe(2);
  });

  it('should credit successfully', () => {
    const wallet = createWallet();

    wallet.credit(
      Money.from({
        amount: '50.00',
        currency: 'BRL',
      }),
    );

    expect(wallet.balance.toJSON().amount).toBe('150.00');
    expect(wallet.version).toBe(2);
  });

  it('should reject insufficient funds', () => {
    const wallet = createWallet();

    expect(() =>
      wallet.debit(
        Money.from({
          amount: '150.00',
          currency: 'BRL',
        }),
      ),
    ).toThrow('INSUFFICIENT_FUNDS');

    expect(wallet.balance.toJSON().amount).toBe('100.00');
    expect(wallet.version).toBe(1);
  });

  it('should reject zero amount', () => {
    const wallet = createWallet();

    expect(() => wallet.debit(Money.zero('BRL'))).toThrow(
      'INVALID_TRANSACTION_AMOUNT',
    );
  });

  it('should reject unsupported currencies', () => {
    expect(() =>
      Money.from({
        amount: '30.00',
        currency: 'USD',
      }),
    ).toThrow('UNSUPPORTED_CURRENCY');
  });

  it('should rehydrate without changing state', () => {
    const wallet = createWallet();

    const restored = Wallet.rehydrate({
      id: wallet.id,
      playerId: wallet.playerId,
      currency: wallet.currency,
      balance: wallet.balance,
      version: wallet.version,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    });

    expect(restored.balance.equals(wallet.balance)).toBe(true);
    expect(restored.version).toBe(1);
  });
});
