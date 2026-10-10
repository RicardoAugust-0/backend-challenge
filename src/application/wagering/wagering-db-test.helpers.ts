import { randomUUID } from 'node:crypto';
import type { MikroORM } from '@mikro-orm/postgresql';
import { OpenWalletUseCase } from './open-wallet.use-case';
import { WalletRepository } from '../../infrastructure/persistence/repositories/wallet.repository';
import { WagerTransactionRepository } from '../../infrastructure/persistence/repositories/wager-transaction.repository';
import { WalletLedgerEntryRepository } from '../../infrastructure/persistence/repositories/wallet-ledger-entry.repository';

export async function openTestWallet(orm: MikroORM): Promise<{
  walletId: string;
  playerId: string;
}> {
  const em = orm.em.fork();
  const useCase = new OpenWalletUseCase(
    em,
    new WalletRepository(em),
    new WagerTransactionRepository(em),
    new WalletLedgerEntryRepository(em),
  );
  const result = await useCase.execute({
    playerId: randomUUID(),
    currency: 'BRL',
    initialBalance: '100.00',
  });
  return { walletId: result.walletId, playerId: result.playerId };
}
