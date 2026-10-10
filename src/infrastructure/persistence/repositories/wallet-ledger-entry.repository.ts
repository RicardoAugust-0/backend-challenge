import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WalletLedgerEntry } from '../../../domain/ledger/wallet-ledger-entry';
import { WalletLedgerEntryEntity } from '../entities/wallet-ledger-entry.entity';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { WalletLedgerEntryMapper } from '../mappers/wallet-ledger-entry.mapper';

@Injectable()
export class WalletLedgerEntryRepository {
  constructor(private readonly em: EntityManager) {}

  // Append-only: no update or delete methods.
  create(entry: WalletLedgerEntry, manager: EntityManager = this.em): void {
    if (!entry.isBalanced()) throw new Error('UNBALANCED_LEDGER_ENTRY');

    const entity = new WalletLedgerEntryEntity();
    entity.id = entry.id;
    entity.wallet = manager.getReference(WalletEntity, entry.walletId);
    entity.transaction = manager.getReference(WagerTransactionEntity, entry.transactionId);
    entity.direction = entry.direction;
    entity.amount = entry.money.toJSON().amount;
    entity.currency = entry.money.currency;
    entity.balanceBefore = entry.balanceBefore.toJSON().amount;
    entity.balanceAfter = entry.balanceAfter.toJSON().amount;
    entity.createdAt = entry.createdAt;
    manager.persist(entity);
  }

  async findByTransactionId(
    transactionId: string,
    manager: EntityManager = this.em,
  ): Promise<WalletLedgerEntry | null> {
    const entity = await manager.findOne(WalletLedgerEntryEntity, {
      transaction: transactionId,
    });
    return entity ? WalletLedgerEntryMapper.toDomain(entity) : null;
  }
}
