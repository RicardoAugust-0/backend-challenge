import { Injectable } from '@nestjs/common';
import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Wallet } from '../../../domain/wallet/wallet';
import { WalletEntity } from '../entities/wallet.entity';
import { WalletMapper } from '../mappers/wallet.mapper';

export class WalletConcurrencyError extends Error {
  constructor() {
    super('WALLET_CONCURRENT_MODIFICATION');
    this.name = 'WalletConcurrencyError';
  }
}

@Injectable()
export class WalletRepository {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string, manager: EntityManager = this.em): Promise<Wallet | null> {
    const entity = await manager.findOne(WalletEntity, { id });
    return entity ? WalletMapper.toDomain(entity) : null;
  }

  async findByPlayerId(
    playerId: string,
    currency = 'BRL',
    manager: EntityManager = this.em,
  ): Promise<Wallet | null> {
    const entity = await manager.findOne(WalletEntity, { playerId, currency });
    return entity ? WalletMapper.toDomain(entity) : null;
  }

  // Must be called inside an active database transaction.
  async findByIdForUpdate(id: string, manager: EntityManager): Promise<Wallet | null> {
    const entity = await manager.findOne(
      WalletEntity,
      { id },
      { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true },
    );
    return entity ? WalletMapper.toDomain(entity) : null;
  }

  // The application service owns flush and commit.
  create(wallet: Wallet, manager: EntityManager = this.em): void {
    manager.persist(WalletMapper.toEntity(wallet));
  }

  // Compare-and-swap version check; callers must debit/credit exactly once.
  async update(wallet: Wallet, manager: EntityManager = this.em): Promise<void> {
    const previousVersion = wallet.version - 1;
    if (previousVersion < 1) throw new Error('INVALID_WALLET_VERSION');

    const affectedRows = await manager.nativeUpdate(
      WalletEntity,
      { id: wallet.id, version: previousVersion },
      {
        balance: wallet.balance.toJSON().amount,
        version: wallet.version,
        updatedAt: wallet.updatedAt,
      },
    );
    if (affectedRows !== 1) throw new WalletConcurrencyError();
  }
}
