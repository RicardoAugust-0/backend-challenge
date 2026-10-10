import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { MikroORM } from '@mikro-orm/postgresql';
import config from '../../mikro-orm.config';
import { WagerTransactionKind, WagerTransactionStatus } from '../../domain/wagering/wager-transaction';
import { WalletEntity } from '../../infrastructure/persistence/entities/wallet.entity';
import { WalletLedgerEntryEntity } from '../../infrastructure/persistence/entities/wallet-ledger-entry.entity';
import { WalletRepository } from '../../infrastructure/persistence/repositories/wallet.repository';
import { WagerTransactionRepository } from '../../infrastructure/persistence/repositories/wager-transaction.repository';
import { WalletLedgerEntryRepository } from '../../infrastructure/persistence/repositories/wallet-ledger-entry.repository';
import { ProcessWagerTransactionUseCase } from './process-wager-transaction.use-case';

let orm: MikroORM;
beforeAll(async () => { if (process.env.RUN_DB_TESTS === '1') orm = await MikroORM.init(config); });
afterAll(async () => { if (orm) await orm.close(true); });
const dbTest = process.env.RUN_DB_TESTS === '1' ? test : test.skip;

dbTest('concurrent 80.00 BETs against 100.00 never overdraw wallet', async () => {
  const wallet = new WalletEntity();
  wallet.id = randomUUID();
  wallet.playerId = randomUUID();
  wallet.balance = '100.00';
  wallet.currency = 'BRL';
  await orm.em.fork().persistAndFlush(wallet);

  const run = () => {
    const em = orm.em.fork();
    const useCase = new ProcessWagerTransactionUseCase(
      em, new WalletRepository(em), new WagerTransactionRepository(em),
      new WalletLedgerEntryRepository(em),
    );
    return useCase.execute({
      providerId: 'integration', externalTransactionId: randomUUID(),
      idempotencyKey: randomUUID(), walletId: wallet.id, playerId: wallet.playerId,
      roundId: 'round-1', gameId: 'game-1', kind: WagerTransactionKind.Bet,
      amount: '80.00', currency: 'BRL',
    });
  };
  const results = await Promise.all([run(), run()]);
  expect(results.filter((r) => r.status === WagerTransactionStatus.Processed).length).toBe(1);
  expect(results.filter((r) => r.status === WagerTransactionStatus.Rejected).length).toBe(1);
  const em = orm.em.fork();
  const stored = await em.findOneOrFail(WalletEntity, { id: wallet.id });
  const ledger = await em.find(WalletLedgerEntryEntity, { wallet: wallet.id });
  expect(stored.balance).toBe('20.00');
  expect(stored.version).toBe(2);
  expect(ledger.length).toBe(1);
});
