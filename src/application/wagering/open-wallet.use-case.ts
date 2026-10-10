import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { LedgerDirection, WalletLedgerEntry } from '../../domain/ledger/wallet-ledger-entry';
import { Money } from '../../domain/money/money';
import {
  WagerTransaction,
  WagerTransactionKind,
  WagerTransactionStatus,
} from '../../domain/wagering/wager-transaction';
import { Wallet } from '../../domain/wallet/wallet';
import { WalletLedgerEntryRepository } from '../../infrastructure/persistence/repositories/wallet-ledger-entry.repository';
import { WagerTransactionRepository } from '../../infrastructure/persistence/repositories/wager-transaction.repository';
import { WalletRepository } from '../../infrastructure/persistence/repositories/wallet.repository';

export interface OpenWalletCommand {
  playerId: string;
  currency: string;
  initialBalance: string;
}

export interface OpenWalletResult {
  walletId: string;
  playerId: string;
  balance: { amount: string; currency: string };
}

@Injectable()
export class OpenWalletUseCase {
  constructor(
    private readonly em: EntityManager,
    private readonly wallets: WalletRepository,
    private readonly transactions: WagerTransactionRepository,
    private readonly ledger: WalletLedgerEntryRepository,
  ) {}

  async execute(command: OpenWalletCommand): Promise<OpenWalletResult> {
    if (!command.playerId?.trim()) throw new Error('INVALID_PLAYER_ID');
    const initialBalance = Money.from({
      amount: command.initialBalance,
      currency: command.currency,
    });
    const wallet = Wallet.open({
      id: randomUUID(),
      playerId: command.playerId,
      initialBalance,
    });

    return this.em.transactional(async (tx) => {
      this.wallets.create(wallet, tx);
      await tx.flush();

      if (initialBalance.isPositive()) {
        const now = new Date();
        const transaction = WagerTransaction.rehydrate({
          id: randomUUID(),
          providerId: 'internal',
          externalTransactionId: randomUUID(),
          idempotencyKey: randomUUID(),
          payloadHash: '0'.repeat(64),
          walletId: wallet.id,
          playerId: wallet.playerId,
          roundId: 'opening',
          gameId: 'opening',
          kind: WagerTransactionKind.Opening,
          money: initialBalance,
          status: WagerTransactionStatus.Processed,
          createdAt: now,
          processedAt: now,
        });

        this.transactions.create(transaction, tx);
        await tx.flush();

        this.ledger.create(
          WalletLedgerEntry.create({
            id: randomUUID(),
            walletId: wallet.id,
            transactionId: transaction.id,
            direction: LedgerDirection.Credit,
            money: initialBalance,
            balanceBefore: Money.zero(command.currency),
            balanceAfter: initialBalance,
            createdAt: now,
          }),
          tx,
        );
        await tx.flush();
      }

      return {
        walletId: wallet.id,
        playerId: wallet.playerId,
        balance: wallet.balance.toJSON(),
      };
    });
  }
}
