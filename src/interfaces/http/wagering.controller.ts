import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Body,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { WagerTransactionKind, WagerTransactionStatus } from '../../domain/wagering/wager-transaction';
import { ProcessWagerTransactionUseCase, WagerIdempotencyConflictError } from '../../application/wagering/process-wager-transaction.use-case';
import { WagerTransactionEntity } from '../../infrastructure/persistence/entities/wager-transaction.entity';

function requiredString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== 'string' || !value.trim() || value.length > 255) {
    throw new BadRequestException({ code: 'INVALID_' + key.toUpperCase() });
  }
  return value;
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException({ code: 'INVALID_REQUEST_BODY' });
  }
  return value as Record<string, unknown>;
}

@Controller('wagering/transactions')
export class WageringController {
  constructor(
    private readonly useCase: ProcessWagerTransactionUseCase,
    private readonly em: EntityManager,
  ) {}

  @Post()
  async submit(@Body() body: unknown, @Headers('idempotency-key') idempotencyKey?: string) {
    const data = asObject(body);
    const money = asObject(data.money);
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 255) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    const kind = requiredString(data, 'kind');
    if (!Object.values(WagerTransactionKind).includes(kind as WagerTransactionKind)) {
      throw new BadRequestException({ code: 'INVALID_TRANSACTION_KIND' });
    }

    try {
      const result = await this.useCase.execute({
        providerId: requiredString(data, 'providerId'),
        externalTransactionId: requiredString(data, 'externalTransactionId'),
        idempotencyKey,
        walletId: requiredString(data, 'walletId'),
        playerId: requiredString(data, 'playerId'),
        roundId: requiredString(data, 'roundId'),
        gameId: requiredString(data, 'gameId'),
        kind: kind as WagerTransactionKind,
        amount: requiredString(money, 'amount'),
        currency: requiredString(money, 'currency'),
      });
      if (result.status === WagerTransactionStatus.Rejected) {
        throw new HttpException({ code: result.failureCode, ...result }, HttpStatus.UNPROCESSABLE_ENTITY);
      }
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof WagerIdempotencyConflictError) {
        throw new ConflictException({ code: error.message });
      }
      if (error instanceof Error) {
        if (error.message === 'WALLET_NOT_FOUND') {
          throw new NotFoundException({ code: error.message });
        }
        if ([
          'UNSUPPORTED_TRANSACTION_KIND', 'UNSUPPORTED_CURRENCY', 'INVALID_MONEY_AMOUNT',
          'INVALID_TRANSACTION_AMOUNT', 'WALLET_PLAYER_MISMATCH', 'CURRENCY_MISMATCH',
        ].includes(error.message)) {
          throw new BadRequestException({ code: error.message });
        }
      }
      throw error;
    }
  }

  @Get(':transactionId')
  async findById(@Param('transactionId') id: string) {
    const entity = await this.em.findOne(WagerTransactionEntity, { id });
    if (!entity) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });
    return {
      transactionId: entity.id,
      providerId: entity.providerId,
      externalTransactionId: entity.externalTransactionId,
      status: entity.status,
      kind: entity.kind,
      money: { amount: entity.amount, currency: entity.currency },
      failureCode: entity.failureCode ?? null,
      balance: entity.responseSnapshot?.balance ?? null,
      createdAt: entity.createdAt,
      processedAt: entity.processedAt ?? null,
    };
  }
}

@Controller('providers/:providerId/wagering/transactions')
export class ProviderTransactionController {
  constructor(private readonly em: EntityManager) {}

  @Get(':externalTransactionId')
  async findByExternalId(
    @Param('providerId') providerId: string,
    @Param('externalTransactionId') externalTransactionId: string,
  ) {
    const transaction = await this.em.findOne(WagerTransactionEntity, {
      providerId,
      externalTransactionId,
    });
    if (!transaction) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });
    return {
      transactionId: transaction.id,
      providerId: transaction.providerId,
      externalTransactionId: transaction.externalTransactionId,
      status: transaction.status,
      kind: transaction.kind,
      money: { amount: transaction.amount, currency: transaction.currency },
      failureCode: transaction.failureCode ?? null,
      balance: transaction.responseSnapshot?.balance ?? null,
    };
  }
}
