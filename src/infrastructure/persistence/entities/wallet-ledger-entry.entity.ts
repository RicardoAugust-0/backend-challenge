import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';

import { LedgerDirection } from '../../../domain/ledger/wallet-ledger-entry';

import { WagerTransactionEntity } from './wager-transaction.entity';
import { WalletEntity } from './wallet.entity';

@Entity({ tableName: 'wallet_ledger_entries' })
@Unique({ properties: ['transaction'] })
@Index({ properties: ['wallet', 'createdAt'] })
export class WalletLedgerEntryEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => WalletEntity, {
    fieldName: 'wallet_id',
  })
  wallet!: WalletEntity;

  @ManyToOne(() => WagerTransactionEntity, {
    fieldName: 'transaction_id',
  })
  transaction!: WagerTransactionEntity;

  @Property({ type: 'string' })
  direction!: LedgerDirection;

  @Property({
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  amount!: string;

  @Property({ type: 'string', length: 3 })
  currency!: string;

  @Property({
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  balanceBefore!: string;

  @Property({
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  balanceAfter!: string;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();
}
