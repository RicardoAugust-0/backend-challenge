import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import mikroOrmConfig from './mikro-orm.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { WageringApplicationModule } from './application/wagering/wagering-application.module';
import { HttpModule } from './interfaces/http/http.module';

@Module({
  imports: [
    MikroOrmModule.forRoot(mikroOrmConfig),
    PersistenceModule,
    WageringApplicationModule,
    HttpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
