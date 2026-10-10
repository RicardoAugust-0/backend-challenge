import { randomUUID } from 'node:crypto';
import { expect, test } from 'bun:test';
import { MikroORM } from '@mikro-orm/postgresql';
import config from '../../mikro-orm.config';
import { WagerTransactionKind, WagerTransactionStatus } from '../../domain/wagering/wager-transaction';
import { WalletEntity } from '../../infrastructure/persistence/entities/wallet.entity';
import { WalletLedgerEntryEntity } from '../../infrastructure/persistence/entities/wallet-ledger-entry.entity';
import { WagerTransactionEntity } from '../../infrastructure/persistence/entities/wager-transaction.entity';
import { WalletRepository } from '../../infrastructure/persistence/repositories/wallet.repository';
import { WagerTransactionRepository } from '../../infrastructure/persistence/repositories/wager-transaction.repository';
import { WalletLedgerEntryRepository } from '../../infrastructure/persistence/repositories/wallet-ledger-entry.repository';
import { ProcessWagerTransactionUseCase } from './process-wager-transaction.use-case';
import { openTestWallet } from './wagering-db-test.helpers';

const dbTest = process.env.RUN_DB_TESTS === '1' ? test : test.skip;

dbTest('WIN and LOSS preserve replay snapshot and ledger accounting', async () => {
  const orm = await MikroORM.init(config);
  try {
    const { walletId, playerId } = await openTestWallet(orm);
    const execute = (command: {
      externalTransactionId: string;
      idempotencyKey: string;
      kind: WagerTransactionKind;
      amount: string;
    }) => {
      const em = orm.em.fork();
      return new ProcessWagerTransactionUseCase(
        em, new WalletRepository(em), new WagerTransactionRepository(em),
        new WalletLedgerEntryRepository(em),
      ).execute({
        providerId: 'integration',
        walletId, playerId,
        roundId: 'round', gameId: 'game', currency: 'BRL',
        ...command,
      });
    };

    const winCommand = {
      externalTransactionId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: WagerTransactionKind.Win,
      amount: '25.00',
    };
    const win = await execute(winCommand);
    expect(win.status).toBe(WagerTransactionStatus.Processed);
    expect(win.balance.amount).toBe('125.00');

    const loss = await execute({
      externalTransactionId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: WagerTransactionKind.Loss,
      amount: '10.00',
    });
    expect(loss.status).toBe(WagerTransactionStatus.Processed);
    expect(loss.balance.amount).toBe('125.00');

    const bet = await execute({
      externalTransactionId: randomUUID(),
      idempotencyKey: randomUUID(),
      kind: WagerTransactionKind.Bet,
      amount: '20.00',
    });
    expect(bet.balance.amount).toBe('105.00');

    const replay = await execute(winCommand);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.transactionId).toBe(win.transactionId);
    expect(replay.balance.amount).toBe('125.00');
    const replayWithNewTransportKey = await execute({
      ...winCommand,
      idempotencyKey: randomUUID(),
    });
    expect(replayWithNewTransportKey.idempotentReplay).toBe(true);
    expect(replayWithNewTransportKey.transactionId).toBe(win.transactionId);
    expect(replayWithNewTransportKey.balance.amount).toBe('125.00');

    const em = orm.em.fork();
    const wallet = await em.findOneOrFail(WalletEntity, { id: walletId });
    const entries = await em.find(WalletLedgerEntryEntity, { wallet: walletId });
    expect(wallet.balance).toBe('105.00');
    expect(wallet.version).toBe(3);
    expect(entries.length).toBe(3); // opening + WIN + BET (LOSS has no entry)
    const sum = entries.reduce((cents, entry) => {
      const value = BigInt(entry.amount.replace('.', ''));
      return cents + (entry.direction === 'CREDIT' ? value : -value);
    }, 0n);
    expect(sum).toBe(10500n);
  } finally {
    await orm.close(true);
  }
}, 30_000);

dbTest('ledger failure rolls back the wallet update and wager record', async () => {
  const orm = await MikroORM.init(config);
  try {
    const { walletId, playerId } = await openTestWallet(orm);
    const em = orm.em.fork();
    const ledgerRepository = new WalletLedgerEntryRepository(em);
    ledgerRepository.create = () => { throw new Error('SIMULATED_LEDGER_FAILURE'); };
    const useCase = new ProcessWagerTransactionUseCase(
      em, new WalletRepository(em), new WagerTransactionRepository(em),
      ledgerRepository,
    );
    await expect(useCase.execute({
      providerId: 'integration', externalTransactionId: randomUUID(),
      idempotencyKey: randomUUID(), walletId, playerId,
      roundId: 'round', gameId: 'game', kind: WagerTransactionKind.Bet,
      amount: '25.00', currency: 'BRL',
    })).rejects.toThrow('SIMULATED_LEDGER_FAILURE');

    const verificationEm = orm.em.fork();
    const wallet = await verificationEm.findOneOrFail(WalletEntity, { id: walletId });
    const transactions = await verificationEm.find(WagerTransactionEntity, { wallet: walletId });
    const entries = await verificationEm.find(WalletLedgerEntryEntity, { wallet: walletId });
    expect(wallet.balance).toBe('100.00');
    expect(wallet.version).toBe(1);
    expect(transactions.length).toBe(1); // only internal opening
    expect(entries.length).toBe(1);
  } finally {
    await orm.close(true);
  }
}, 30_000);
