import { Migration } from '@mikro-orm/migrations';

export class Migration20261010020000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "wager_transactions" add column "response_snapshot" jsonb null;');
  }
  override async down(): Promise<void> {
    this.addSql('alter table "wager_transactions" drop column "response_snapshot";');
  }
}
