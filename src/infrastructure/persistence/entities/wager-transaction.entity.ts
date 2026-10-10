import {
  Entity,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';

import {
  WagerTransactionKind,
  WagerTransactionStatus,
} from '../../../domain/wagering/wager-transaction';

import type { FailureCode } from '../../../domain/wagering/wager-transaction';
import type { ProcessWagerResult } from '../../../application/wagering/process-wager-transaction.use-case';

import { WalletEntity } from './wallet.entity';

@Entity({ tableName: 'wager_transactions' })
@Unique({ properties: ['providerId', 'externalTransactionId'] })
@Unique({ properties: ['providerId', 'idempotencyKey'] })
@Index({ properties: ['providerId', 'referenceExternalTransactionId'] })
export class WagerTransactionEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string' })
  providerId!: string;

  @Property({ type: 'string' })
  externalTransactionId!: string;

  @Property({ type: 'string' })
  idempotencyKey!: string;

  @Property({ type: 'string', length: 64 })
  payloadHash!: string;

  @ManyToOne(() => WalletEntity, { fieldName: 'wallet_id' })
  wallet!: WalletEntity;

  @Property({ type: 'string' })
  playerId!: string;

  @Property({ type: 'string' })
  roundId!: string;

  @Property({ type: 'string' })
  gameId!: string;

  @Property({ type: 'string' })
  kind!: WagerTransactionKind;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  amount!: string;

  @Property({ type: 'string', length: 3 })
  currency!: string;

  @Property({ type: 'string' })
  status: WagerTransactionStatus = WagerTransactionStatus.Pending;

  @Property({ type: 'string', nullable: true })
  referenceExternalTransactionId?: string;

  @ManyToOne(() => WagerTransactionEntity, {
    fieldName: 'reference_transaction_id',
    nullable: true,
  })
  referenceTransaction?: WagerTransactionEntity;

  @Property({ type: 'string', nullable: true })
  failureCode?: FailureCode;

  @Property({ type: 'json', nullable: true })
  responseSnapshot?: ProcessWagerResult;

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date;
}
