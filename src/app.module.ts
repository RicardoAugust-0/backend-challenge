import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { WageringApplicationModule } from './application/wagering/wagering-application.module';
import { HttpModule } from './interfaces/http/http.module';

@Module({
  imports: [
    DatabaseModule,
    PersistenceModule,
    WageringApplicationModule,
    HttpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
