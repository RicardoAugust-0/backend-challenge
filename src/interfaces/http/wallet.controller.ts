import { UniqueConstraintViolationException } from '@mikro-orm/core';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Query,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import Decimal from 'decimal.js';
import { OpenWalletUseCase } from '../../application/wagering/open-wallet.use-case';
import { WalletRepository } from '../../infrastructure/persistence/repositories/wallet.repository';

interface MoneyInput { amount: string; currency: string }

function assertWalletId(walletId: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(walletId)) {
    throw new BadRequestException({ code: 'INVALID_WALLET_ID' });
  }
}

function parseOpeningBody(value: unknown): { playerId: string; initialBalance: MoneyInput } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST_BODY' });
  }
  const body = value as Record<string, unknown>;
  const balance = body.initialBalance;
  if (
    typeof body.playerId !== 'string' || body.playerId.trim().length === 0 ||
    body.playerId.length > 255 ||
    !balance || typeof balance !== 'object' || Array.isArray(balance)
  ) {
    throw new BadRequestException({ code: 'INVALID_WALLET_BODY' });
  }
  const money = balance as Record<string, unknown>;
  if (typeof money.amount !== 'string' || typeof money.currency !== 'string') {
    throw new BadRequestException({ code: 'INVALID_INITIAL_BALANCE' });
  }
  return { playerId: body.playerId, initialBalance: { amount: money.amount, currency: money.currency } };
}

@Controller('wallets')
export class WalletController {
  constructor(
    private readonly openWallet: OpenWalletUseCase,
    private readonly wallets: WalletRepository,
    private readonly em: EntityManager,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    const input = parseOpeningBody(body);
    try {
      const result = await this.openWallet.execute({
        playerId: input.playerId,
        currency: input.initialBalance.currency,
        initialBalance: input.initialBalance.amount,
      });
      return {
        id: result.walletId,
        playerId: result.playerId,
        balance: result.balance,
        version: 1,
      };
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException ||
          (error instanceof Error && (error as Error & { code?: string }).code === '23505')) {
        throw new ConflictException({ code: 'WALLET_ALREADY_EXISTS' });
      }
      if (error instanceof Error && [
        'UNSUPPORTED_CURRENCY', 'INVALID_MONEY_AMOUNT', 'NEGATIVE_INITIAL_BALANCE',
      ].includes(error.message)) {
        throw new BadRequestException({ code: error.message });
      }
      throw error;
    }
  }

  @Get(':walletId')
  async findById(@Param('walletId') walletId: string) {
    assertWalletId(walletId);
    const wallet = await this.wallets.findById(walletId);
    if (!wallet) throw new NotFoundException({ code: 'WALLET_NOT_FOUND' });
    return {
      id: wallet.id,
      playerId: wallet.playerId,
      balance: wallet.balance.toJSON(),
      version: wallet.version,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  @Get(':walletId/ledger')
  async listLedger(
    @Param('walletId') walletId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitParam?: string,
  ) {
    assertWalletId(walletId);
    const limit = limitParam === undefined ? 50 : Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException({ code: 'INVALID_PAGE_LIMIT' });
    }
    const wallet = await this.wallets.findById(walletId);
    if (!wallet) throw new NotFoundException({ code: 'WALLET_NOT_FOUND' });

    let last: { createdAt: string; id: string } | null = null;
    if (cursor !== undefined) {
      try {
        const data: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
        const value = data as Record<string, unknown>;
        if (typeof value.createdAt !== 'string' || typeof value.id !== 'string' ||
            !Number.isFinite(Date.parse(value.createdAt)) ||
            !/^[0-9a-f-]{36}$/i.test(value.id)) throw new Error();
        last = { createdAt: value.createdAt, id: value.id };
      } catch {
        throw new BadRequestException({ code: 'INVALID_LEDGER_CURSOR' });
      }
    }

    type LedgerRow = {
      id: string;
      transaction_id: string;
      direction: string;
      amount: string;
      currency: string;
      balance_before: string;
      balance_after: string;
      created_at: Date;
    };
    const where = last ? 'and (created_at, id) < (?::timestamptz, ?::uuid)' : '';
    const params: (string | number)[] = [walletId];
    if (last) params.push(last.createdAt, last.id);
    params.push(limit + 1);
    const records = await this.em.getConnection().execute<LedgerRow[]>(
      `select id, transaction_id, direction, amount, currency,
              balance_before, balance_after, created_at
       from wallet_ledger_entries
       where wallet_id = ? ${where}
       order by created_at desc, id desc
       limit ?`,
      params,
    );
    const hasMore = records.length > limit;
    const visible = records.slice(0, limit);
    const finalEntry = visible[visible.length - 1];
    const nextCursor = hasMore && finalEntry
      ? Buffer.from(JSON.stringify({
          createdAt: new Date(finalEntry.created_at).toISOString(),
          id: finalEntry.id,
        })).toString('base64url')
      : null;

    return {
      items: visible.map((entry) => ({
        id: entry.id,
        transactionId: entry.transaction_id,
        direction: entry.direction,
        amount: { amount: entry.amount, currency: entry.currency },
        balanceBefore: { amount: entry.balance_before, currency: entry.currency },
        balanceAfter: { amount: entry.balance_after, currency: entry.currency },
        createdAt: entry.created_at,
      })),
      nextCursor,
    };
  }

  @Post(':walletId/reconciliation')
  async reconcile(@Param('walletId') walletId: string) {
    assertWalletId(walletId);
    // One SQL statement ensures a consistent snapshot of wallet and ledger.
    const rows = await this.em.getConnection().execute<Array<{
      wallet_id: string;
      stored_balance: string;
      calculated_balance: string;
      checked_entries: string;
      currency: string;
    }>>(
      `select w.id as wallet_id,
              w.balance as stored_balance,
              w.currency as currency,
              coalesce(sum(case when l.direction = 'CREDIT' then l.amount
                                when l.direction = 'DEBIT' then -l.amount end), 0) as calculated_balance,
              count(l.id) as checked_entries
       from wallets w left join wallet_ledger_entries l on l.wallet_id = w.id
       where w.id = ?
       group by w.id, w.balance, w.currency`,
      [walletId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException({ code: 'WALLET_NOT_FOUND' });
    const difference = new Decimal(row.stored_balance).minus(row.calculated_balance);
    return {
      walletId,
      storedBalance: { amount: new Decimal(row.stored_balance).toFixed(2), currency: row.currency },
      calculatedBalance: { amount: new Decimal(row.calculated_balance).toFixed(2), currency: row.currency },
      difference: { amount: difference.toFixed(2), currency: row.currency },
      consistent: difference.isZero(),
      checkedEntries: Number(row.checked_entries),
    };
  }
}
