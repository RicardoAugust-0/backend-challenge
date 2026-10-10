import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WagerTransaction } from '../../../domain/wagering/wager-transaction';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { WagerTransactionMapper } from '../mappers/wager-transaction.mapper';

@Injectable()
export class WagerTransactionRepository {
  constructor(private readonly em: EntityManager) {}

  async findByIdempotencyKey(
    providerId: string,
    idempotencyKey: string,
    manager: EntityManager = this.em,
  ): Promise<WagerTransaction | null> {
    const entity = await manager.findOne(WagerTransactionEntity, { providerId, idempotencyKey });
    return entity ? WagerTransactionMapper.toDomain(entity) : null;
  }

  async findByExternalId(
    providerId: string,
    externalTransactionId: string,
    manager: EntityManager = this.em,
  ): Promise<WagerTransaction | null> {
    const entity = await manager.findOne(WagerTransactionEntity, {
      providerId,
      externalTransactionId,
    });
    return entity ? WagerTransactionMapper.toDomain(entity) : null;
  }

  // Persist only; the use case must commit wallet, transaction and ledger atomically.
  create(transaction: WagerTransaction, manager: EntityManager = this.em): void {
    const entity = new WagerTransactionEntity();
    entity.id = transaction.id;
    entity.providerId = transaction.providerId;
    entity.externalTransactionId = transaction.externalTransactionId;
    entity.idempotencyKey = transaction.idempotencyKey;
    entity.payloadHash = transaction.payloadHash;
    entity.wallet = manager.getReference(WalletEntity, transaction.walletId);
    entity.playerId = transaction.playerId;
    entity.roundId = transaction.roundId;
    entity.gameId = transaction.gameId;
    entity.kind = transaction.kind;
    entity.amount = transaction.money.toJSON().amount;
    entity.currency = transaction.money.currency;
    entity.status = transaction.status;
    entity.referenceExternalTransactionId = transaction.referenceExternalTransactionId;
    entity.referenceTransaction = transaction.referenceTransactionId
      ? manager.getReference(WagerTransactionEntity, transaction.referenceTransactionId)
      : undefined;
    entity.failureCode = transaction.failureCode;
    entity.createdAt = transaction.createdAt;
    entity.processedAt = transaction.processedAt;
    manager.persist(entity);
  }

  async updateStatus(
    transaction: WagerTransaction,
    manager: EntityManager = this.em,
  ): Promise<void> {
    const affectedRows = await manager.nativeUpdate(
      WagerTransactionEntity,
      { id: transaction.id },
      {
        status: transaction.status,
        failureCode: transaction.failureCode ?? null,
        processedAt: transaction.processedAt ?? null,
        referenceTransaction: transaction.referenceTransactionId
          ? manager.getReference(WagerTransactionEntity, transaction.referenceTransactionId)
          : null,
      },
    );
    if (affectedRows !== 1) throw new Error('WAGER_TRANSACTION_NOT_FOUND');
  }
}
