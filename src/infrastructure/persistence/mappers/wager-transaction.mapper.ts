import { Money } from '../../../domain/money/money';
import { WagerTransaction } from '../../../domain/wagering/wager-transaction';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity';

export class WagerTransactionMapper {
  static toDomain(entity: WagerTransactionEntity): WagerTransaction {
    return WagerTransaction.rehydrate({
      id: entity.id,
      providerId: entity.providerId,
      externalTransactionId: entity.externalTransactionId,
      idempotencyKey: entity.idempotencyKey,
      payloadHash: entity.payloadHash,
      walletId: entity.wallet.id,
      playerId: entity.playerId,
      roundId: entity.roundId,
      gameId: entity.gameId,
      kind: entity.kind,
      money: Money.from({ amount: entity.amount, currency: entity.currency }),
      referenceExternalTransactionId: entity.referenceExternalTransactionId,
      referenceTransactionId: entity.referenceTransaction?.id,
      status: entity.status,
      failureCode: entity.failureCode,
      createdAt: entity.createdAt,
      processedAt: entity.processedAt,
    });
  }
}
