import { Money } from '../money/money';

export interface WalletState {
  id: string;
  playerId: string;
  currency: string;
  balance: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    public readonly currency: string,
    private _balance: Money,
    private _version: number,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static open(props: {
    id: string;
    playerId: string;
    initialBalance: Money;
  }): Wallet {
    if (props.initialBalance.isNegative()) {
      throw new Error('NEGATIVE_INITIAL_BALANCE');
    }

    const now = new Date();

    return new Wallet(
      props.id,
      props.playerId,
      props.initialBalance.currency,
      props.initialBalance,
      1,
      now,
      now,
    );
  }

  static rehydrate(state: WalletState): Wallet {
    return new Wallet(
      state.id,
      state.playerId,
      state.currency,
      state.balance,
      state.version,
      state.createdAt,
      state.updatedAt,
    );
  }

  get balance(): Money {
    return this._balance;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  debit(money: Money): void {
    this.assertSameCurrency(money);
    this.assertPositiveAmount(money);

    if (this._balance.isLessThan(money)) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    this._balance = this._balance.subtract(money);
    this.incrementVersion();
  }

  credit(money: Money): void {
    this.assertSameCurrency(money);
    this.assertPositiveAmount(money);

    this._balance = this._balance.add(money);
    this.incrementVersion();
  }

  private assertSameCurrency(money: Money): void {
    if (this.currency !== money.currency) {
      throw new Error('CURRENCY_MISMATCH');
    }
  }

  private assertPositiveAmount(money: Money): void {
    if (!money.isPositive()) {
      throw new Error('INVALID_TRANSACTION_AMOUNT');
    }
  }

  private incrementVersion(): void {
    this._version += 1;
    this._updatedAt = new Date();
  }
}
