import { randomUUID } from 'node:crypto';
import { expect, test } from 'bun:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';

const dbTest = process.env.RUN_DB_TESTS === '1' ? test : test.skip;

dbTest('HTTP wallet, BET, replay, lookups and reconciliation', async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  try {
    const http = request(app.getHttpServer());
    const playerId = randomUUID();
    const walletResponse = await http.post('/wallets').send({
      playerId,
      initialBalance: { amount: '100.00', currency: 'BRL' },
    });
    expect(walletResponse.status).toBe(201);
    expect(walletResponse.body.balance.amount).toBe('100.00');
    const walletId = walletResponse.body.id as string;

    const wager = {
      providerId: 'http-integration',
      externalTransactionId: randomUUID(),
      playerId,
      walletId,
      roundId: 'round-1',
      gameId: 'game-1',
      kind: 'BET',
      money: { amount: '80.00', currency: 'BRL' },
    };
    const key = randomUUID();
    const first = await http.post('/wagering/transactions')
      .set('Idempotency-Key', key).send(wager);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('PROCESSED');
    expect(first.body.balance.amount).toBe('20.00');

    const replay = await http.post('/wagering/transactions')
      .set('Idempotency-Key', key).send(wager);
    expect(replay.status).toBe(201);
    expect(replay.body.idempotentReplay).toBe(true);
    expect(replay.body.transactionId).toBe(first.body.transactionId);

    const conflict = await http.post('/wagering/transactions')
      .set('Idempotency-Key', key)
      .send({ ...wager, money: { amount: '10.00', currency: 'BRL' } });
    expect(conflict.status).toBe(409);

    const insufficient = await http.post('/wagering/transactions')
      .set('Idempotency-Key', randomUUID())
      .send({ ...wager, externalTransactionId: randomUUID(), money: { amount: '30.00', currency: 'BRL' } });
    expect(insufficient.status).toBe(422);
    expect(insufficient.body.code).toBe('INSUFFICIENT_FUNDS');

    const wallet = await http.get('/wallets/' + walletId);
    expect(wallet.status).toBe(200);
    expect(wallet.body.balance.amount).toBe('20.00');

    const transaction = await http.get('/wagering/transactions/' + first.body.transactionId);
    expect(transaction.status).toBe(200);
    expect(transaction.body.kind).toBe('BET');

    const byProvider = await http.get('/providers/http-integration/wagering/transactions/' + wager.externalTransactionId);
    expect(byProvider.status).toBe(200);
    expect(byProvider.body.transactionId).toBe(first.body.transactionId);

    const reconciliation = await http.post('/wallets/' + walletId + '/reconciliation');
    expect(reconciliation.status).toBe(201);
    expect(reconciliation.body.consistent).toBe(true);
    expect(reconciliation.body.storedBalance.amount).toBe('20.00');
    expect(reconciliation.body.calculatedBalance.amount).toBe('20.00');
    expect(reconciliation.body.checkedEntries).toBe(2);

    const firstPage = await http.get('/wallets/' + walletId + '/ledger?limit=1');
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items.length).toBe(1);
    expect(firstPage.body.items[0].direction).toBe('DEBIT');
    expect(typeof firstPage.body.nextCursor).toBe('string');

    const secondPage = await http.get('/wallets/' + walletId + '/ledger')
      .query({ limit: 1, cursor: firstPage.body.nextCursor });
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items.length).toBe(1);
    expect(secondPage.body.items[0].direction).toBe('CREDIT');
    expect(secondPage.body.nextCursor).toBeNull();

    const invalidCursor = await http.get('/wallets/' + walletId + '/ledger')
      .query({ cursor: 'not-a-cursor' });
    expect(invalidCursor.status).toBe(400);

    const duplicateWallet = await http.post('/wallets').send({
      playerId, initialBalance: { amount: '100.00', currency: 'BRL' },
    });
    expect(duplicateWallet.status).toBe(409);
  } finally {
    await app.close();
  }
}, 30_000);
