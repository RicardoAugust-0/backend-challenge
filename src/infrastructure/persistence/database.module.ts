import { Global, Injectable, Module, OnApplicationShutdown, Scope } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import mikroOrmConfig from '../../mikro-orm.config';

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(private readonly orm: MikroORM) {}

  async onApplicationShutdown(): Promise<void> {
    await this.orm.close(true);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: MikroORM,
      useFactory: () => MikroORM.init(mikroOrmConfig),
    },
    {
      provide: EntityManager,
      scope: Scope.REQUEST,
      useFactory: (orm: MikroORM) => orm.em.fork(),
      inject: [MikroORM],
    },
    DatabaseLifecycle,
  ],
  exports: [MikroORM, EntityManager],
})
export class DatabaseModule {}
