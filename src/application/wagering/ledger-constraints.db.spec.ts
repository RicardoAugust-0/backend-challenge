import { expect, test } from 'bun:test';
import { MikroORM } from '@mikro-orm/postgresql';
import config from '../../mikro-orm.config';
import { WalletEntity } from '../../infrastructure/persistence/entities/wallet.entity';
import { WalletLedgerEntryEntity } from '../../infrastructure/persistence/entities/wallet-ledger-entry.entity';
import { openTestWallet } from './wagering-db-test.helpers';

const dbTest = process.env.RUN_DB_TESTS === '1' ? test : test.skip;

dbTest('PostgreSQL rejects mutation of immutable ledger rows', async () => {
  const orm = await MikroORM.init(config);
  try {
    const { walletId } = await openTestWallet(orm);
    const entry = await orm.em.fork().findOneOrFail(WalletLedgerEntryEntity, { wallet: walletId });
    const conn = orm.em.getConnection();

    await expect(conn.execute(
      'update wallet_ledger_entries set amount = ? where id = ?',
      ['99.00', entry.id],
    )).rejects.toThrow();

    await expect(conn.execute(
      'delete from wallet_ledger_entries where id = ?',
      [entry.id],
    )).rejects.toThrow();

    const after = await orm.em.fork().findOneOrFail(WalletLedgerEntryEntity, { id: entry.id });
    expect(after.amount).toBe('100.00');
  } finally {
    await orm.close(true);
  }
}, 30_000);

dbTest('PostgreSQL prevents a negative wallet balance', async () => {
  const orm = await MikroORM.init(config);
  try {
    const { walletId } = await openTestWallet(orm);
    await expect(orm.em.getConnection().execute(
      'update wallets set balance = ? where id = ?',
      ['-1.00', walletId],
    )).rejects.toThrow();
    const wallet = await orm.em.fork().findOneOrFail(WalletEntity, { id: walletId });
    expect(wallet.balance).toBe('100.00');
  } finally {
    await orm.close(true);
  }
}, 30_000);
