import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'wallets' })
export class WalletEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({
    type: 'decimal',
    precision: 20,
    scale: 2,
  })
  balance!: string;

  @Property({ type: 'integer', default: 0 })
  version: number = 0;

  @Property({
    type: 'timestamptz',
    onCreate: () => new Date(),
  })
  createdAt: Date = new Date();

  @Property({
    type: 'timestamptz',
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
