import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import mikroOrmConfig from './mikro-orm.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';

@Module({
  imports: [MikroOrmModule.forRoot(mikroOrmConfig), PersistenceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
