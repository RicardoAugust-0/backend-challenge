import { describe, expect, it } from 'bun:test';
import { Money } from './money';

describe('Money', () => {
  it('should add money correctly', () => {
    const a = Money.from({
      amount: '15.75',
      currency: 'BRL',
    });

    const b = Money.from({
      amount: '24.25',
      currency: 'BRL',
    });

    expect(a.add(b).toJSON()).toEqual({
      amount: '40.00',
      currency: 'BRL',
    });
  });

  it('should subtract money correctly', () => {
    const a = Money.from({
      amount: '40.00',
      currency: 'BRL',
    });

    const b = Money.from({
      amount: '15.75',
      currency: 'BRL',
    });

    expect(a.subtract(b).toJSON()).toEqual({
      amount: '24.25',
      currency: 'BRL',
    });
  });

  it('should reject invalid amounts', () => {
    expect(() =>
      Money.from({
        amount: '10.999',
        currency: 'BRL',
      }),
    ).toThrow('INVALID_MONEY_AMOUNT');
  });

  it('should reject unsupported currencies', () => {
    expect(() =>
      Money.from({
        amount: '10.00',
        currency: 'USD',
      }),
    ).toThrow('UNSUPPORTED_CURRENCY');
  });

  it('should preserve immutability', () => {
    const original = Money.from({
      amount: '100.00',
      currency: 'BRL',
    });

    const debit = Money.from({
      amount: '30.00',
      currency: 'BRL',
    });

    const result = original.subtract(debit);

    expect(original.toJSON().amount).toBe('100.00');
    expect(result.toJSON().amount).toBe('70.00');
  });
});
