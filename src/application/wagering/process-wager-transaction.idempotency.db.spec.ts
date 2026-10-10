import { randomUUID } from 'node:crypto';
import { expect, test } from 'bun:test';
import { MikroORM } from '@mikro-orm/postgresql';
import config from '../../mikro-orm.config';
import { WagerTransactionKind } from '../../domain/wagering/wager-transaction';
import { WalletEntity } from '../../infrastructure/persistence/entities/wallet.entity';
import { WalletLedgerEntryEntity } from '../../infrastructure/persistence/entities/wallet-ledger-entry.entity';
import { WalletRepository } from '../../infrastructure/persistence/repositories/wallet.repository';
import { WagerTransactionRepository } from '../../infrastructure/persistence/repositories/wager-transaction.repository';
import { WalletLedgerEntryRepository } from '../../infrastructure/persistence/repositories/wallet-ledger-entry.repository';
import { ProcessWagerTransactionUseCase, WagerIdempotencyConflictError } from './process-wager-transaction.use-case';

const dbTest = process.env.RUN_DB_TESTS === '1' ? test : test.skip;
dbTest('50 duplicate requests debit exactly once and conflicting payload fails', async () => {
  const orm = await MikroORM.init(config);
  try {
    const wallet = new WalletEntity();
    wallet.id = randomUUID();
    wallet.playerId = randomUUID();
    wallet.balance = '100.00';
    await orm.em.fork().persistAndFlush(wallet);

    const input = {
      providerId: 'provider', externalTransactionId: randomUUID(),
      idempotencyKey: randomUUID(), walletId: wallet.id, playerId: wallet.playerId,
      roundId: 'round', gameId: 'game', kind: WagerTransactionKind.Bet,
      amount: '10.00', currency: 'BRL',
    };
    const execute = (command = input) => {
      const em = orm.em.fork();
      return new ProcessWagerTransactionUseCase(
        em, new WalletRepository(em), new WagerTransactionRepository(em),
        new WalletLedgerEntryRepository(em),
      ).execute(command);
    };

    const results = await Promise.all(Array.from({ length: 50 }, () => execute()));
    expect(results.filter((r) => !r.idempotentReplay).length).toBe(1);
    expect(new Set(results.map((r) => r.transactionId)).size).toBe(1);
    expect(results.every((r) => r.balance.amount === '90.00')).toBe(true);
    await expect(execute({ ...input, amount: '20.00' })).rejects.toBeInstanceOf(
      WagerIdempotencyConflictError,
    );
    const em = orm.em.fork();
    const updated = await em.findOneOrFail(WalletEntity, { id: wallet.id });
    const entries = await em.find(WalletLedgerEntryEntity, { wallet: wallet.id });
    expect(updated.balance).toBe('90.00');
    expect(entries.length).toBe(1);
  } finally {
    await orm.close(true);
  }
});
