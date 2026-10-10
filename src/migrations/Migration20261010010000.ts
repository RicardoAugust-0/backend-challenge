import { Migration } from '@mikro-orm/migrations';

export class Migration20261010010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "wallets"
        add constraint "wallets_balance_nonnegative_check"
        check ("balance" >= 0);
    `);

    this.addSql(`
      alter table "wager_transactions"
        add constraint "wager_transactions_amount_positive_check"
        check ("amount" > 0);
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
        add constraint "wallet_ledger_entries_amount_positive_check"
        check ("amount" > 0);
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
        add constraint "wallet_ledger_entries_balances_nonnegative_check"
        check ("balance_before" >= 0 and "balance_after" >= 0);
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
        add constraint "wallet_ledger_entries_direction_check"
        check ("direction" in ('DEBIT', 'CREDIT'));
    `);

    this.addSql(`
      alter table "wallet_ledger_entries"
        add constraint "wallet_ledger_entries_arithmetic_check"
        check (
          ("direction" = 'CREDIT' and "balance_after" = "balance_before" + "amount")
          or
          ("direction" = 'DEBIT' and "balance_after" = "balance_before" - "amount")
        );
    `);

    this.addSql(`
      create function prevent_wallet_ledger_mutation()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception 'LEDGER_ENTRIES_ARE_IMMUTABLE'
          using errcode = '23514';
      end;
      $$;
    `);

    this.addSql(`
      create trigger wallet_ledger_entries_immutable_trigger
      before update or delete on "wallet_ledger_entries"
      for each row execute function prevent_wallet_ledger_mutation();
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      drop trigger if exists wallet_ledger_entries_immutable_trigger
      on "wallet_ledger_entries";
    `);
    this.addSql('drop function if exists prevent_wallet_ledger_mutation();');

    this.addSql(`
      alter table "wallet_ledger_entries"
        drop constraint if exists "wallet_ledger_entries_arithmetic_check";
    `);
    this.addSql(`
      alter table "wallet_ledger_entries"
        drop constraint if exists "wallet_ledger_entries_direction_check";
    `);
    this.addSql(`
      alter table "wallet_ledger_entries"
        drop constraint if exists "wallet_ledger_entries_balances_nonnegative_check";
    `);
    this.addSql(`
      alter table "wallet_ledger_entries"
        drop constraint if exists "wallet_ledger_entries_amount_positive_check";
    `);
    this.addSql(`
      alter table "wager_transactions"
        drop constraint if exists "wager_transactions_amount_positive_check";
    `);
    this.addSql(`
      alter table "wallets"
        drop constraint if exists "wallets_balance_nonnegative_check";
    `);
  }
}
