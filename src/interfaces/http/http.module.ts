import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { WageringApplicationModule } from '../../application/wagering/wagering-application.module';
import { WageringController, ProviderTransactionController } from './wagering.controller';
import { WalletController } from './wallet.controller';

@Module({
  imports: [PersistenceModule, WageringApplicationModule],
  controllers: [WageringController, ProviderTransactionController, WalletController],
})
export class HttpModule {}
