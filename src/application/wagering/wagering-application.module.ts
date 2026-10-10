import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { ProcessWagerTransactionUseCase } from './process-wager-transaction.use-case';

@Module({
  imports: [PersistenceModule],
  providers: [ProcessWagerTransactionUseCase],
  exports: [ProcessWagerTransactionUseCase],
})
export class WageringApplicationModule {}
