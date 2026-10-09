import { Money } from './domain/money/money';

const a = Money.from({
  amount: '15.75',
  currency: 'BRL',
});

const b = Money.from({
  amount: '24.25',
  currency: 'BRL',
});

console.log(a.add(b).toJSON());
