import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { OpenWalletUseCase } from './open-wallet.use-case';
import { ProcessWagerTransactionUseCase } from './process-wager-transaction.use-case';

@Module({
  imports: [PersistenceModule],
  providers: [OpenWalletUseCase, ProcessWagerTransactionUseCase],
  exports: [OpenWalletUseCase, ProcessWagerTransactionUseCase],
})
export class WageringApplicationModule {}
