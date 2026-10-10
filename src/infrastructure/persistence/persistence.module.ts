import { Module } from '@nestjs/common';
import { WalletRepository } from './repositories/wallet.repository';
import { WagerTransactionRepository } from './repositories/wager-transaction.repository';
import { WalletLedgerEntryRepository } from './repositories/wallet-ledger-entry.repository';

@Module({
  providers: [WalletRepository, WagerTransactionRepository, WalletLedgerEntryRepository],
  exports: [WalletRepository, WagerTransactionRepository, WalletLedgerEntryRepository],
})
export class PersistenceModule {}
