import { Migration } from '@mikro-orm/migrations';

export class Migration20261010002416 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "wallets" ("id" uuid not null, "balance" numeric(20,2) not null, "version" int not null default 0, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "wallets_pkey" primary key ("id"));`);
  }

}
