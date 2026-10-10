import { Money } from '../../../domain/money/money';
import { WalletLedgerEntry } from '../../../domain/ledger/wallet-ledger-entry';
import { WalletLedgerEntryEntity } from '../entities/wallet-ledger-entry.entity';

export class WalletLedgerEntryMapper {
  static toDomain(entity: WalletLedgerEntryEntity): WalletLedgerEntry {
    const currency = entity.currency;
    return WalletLedgerEntry.rehydrate({
      id: entity.id,
      walletId: entity.wallet.id,
      transactionId: entity.transaction.id,
      direction: entity.direction,
      money: Money.from({ amount: entity.amount, currency }),
      balanceBefore: Money.from({ amount: entity.balanceBefore, currency }),
      balanceAfter: Money.from({ amount: entity.balanceAfter, currency }),
      createdAt: entity.createdAt,
    });
  }
}
