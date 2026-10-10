import { Migration } from '@mikro-orm/migrations';

export class Migration20261010004136 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "wager_transactions" ("id" uuid not null, "provider_id" varchar(255) not null, "external_transaction_id" varchar(255) not null, "idempotency_key" varchar(255) not null, "payload_hash" varchar(64) not null, "wallet_id" uuid not null, "player_id" varchar(255) not null, "round_id" varchar(255) not null, "game_id" varchar(255) not null, "kind" varchar(255) not null, "amount" numeric(20,2) not null, "currency" varchar(3) not null, "status" varchar(255) not null default 'PENDING', "reference_external_transaction_id" varchar(255) null, "reference_transaction_id" uuid null, "failure_code" varchar(255) null, "created_at" timestamptz not null, "processed_at" timestamptz null, constraint "wager_transactions_pkey" primary key ("id"));`);
    this.addSql(`create index "wager_transactions_provider_id_reference_external__b8537_index" on "wager_transactions" ("provider_id", "reference_external_transaction_id");`);
    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_provider_id_idempotency_key_unique" unique ("provider_id", "idempotency_key");`);
    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_provider_id_external_transaction_id_unique" unique ("provider_id", "external_transaction_id");`);

    this.addSql(`create table "wallet_ledger_entries" ("id" uuid not null, "wallet_id" uuid not null, "transaction_id" uuid not null, "direction" varchar(255) not null, "amount" numeric(20,2) not null, "currency" varchar(3) not null, "balance_before" numeric(20,2) not null, "balance_after" numeric(20,2) not null, "created_at" timestamptz not null, constraint "wallet_ledger_entries_pkey" primary key ("id"));`);
    this.addSql(`create index "wallet_ledger_entries_wallet_id_created_at_index" on "wallet_ledger_entries" ("wallet_id", "created_at");`);
    this.addSql(`alter table "wallet_ledger_entries" add constraint "wallet_ledger_entries_transaction_id_unique" unique ("transaction_id");`);

    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_wallet_id_foreign" foreign key ("wallet_id") references "wallets" ("id") on update cascade;`);
    this.addSql(`alter table "wager_transactions" add constraint "wager_transactions_reference_transaction_id_foreign" foreign key ("reference_transaction_id") references "wager_transactions" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "wallet_ledger_entries" add constraint "wallet_ledger_entries_wallet_id_foreign" foreign key ("wallet_id") references "wallets" ("id") on update cascade;`);
    this.addSql(`alter table "wallet_ledger_entries" add constraint "wallet_ledger_entries_transaction_id_foreign" foreign key ("transaction_id") references "wager_transactions" ("id") on update cascade;`);

    this.addSql(`alter table "wallets" add column "player_id" varchar(255) not null, add column "currency" varchar(3) not null default 'BRL';`);
    this.addSql(`alter table "wallets" alter column "version" type int using ("version"::int);`);
    this.addSql(`alter table "wallets" alter column "version" set default 1;`);
    this.addSql(`alter table "wallets" add constraint "wallets_player_id_currency_unique" unique ("player_id", "currency");`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "wager_transactions" drop constraint "wager_transactions_reference_transaction_id_foreign";`);

    this.addSql(`alter table "wallet_ledger_entries" drop constraint "wallet_ledger_entries_transaction_id_foreign";`);

    this.addSql(`drop table if exists "wager_transactions" cascade;`);

    this.addSql(`drop table if exists "wallet_ledger_entries" cascade;`);

    this.addSql(`alter table "wallets" drop constraint "wallets_player_id_currency_unique";`);
    this.addSql(`alter table "wallets" drop column "player_id", drop column "currency";`);

    this.addSql(`alter table "wallets" alter column "version" type int using ("version"::int);`);
    this.addSql(`alter table "wallets" alter column "version" set default 0;`);
  }

}
