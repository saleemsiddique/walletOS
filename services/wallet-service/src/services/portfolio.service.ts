import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { getOrRefreshPrice } from '../lib/twelvedata';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

export type PortfolioPosition = {
  ticker: string;
  asset_name: string;
  shares: string;
  avg_cost_per_share: string;
  current_price: string;
  currency: string;
  market_open: boolean;
  value: string;
  cost: string;
  gain: string;
  gain_pct: string;
};

export type PortfolioResponse = {
  positions: PortfolioPosition[];
  total_value: string;
  total_cost: string;
  total_gain: string;
  total_gain_pct: string;
  last_updated: string;
};

type PositionAccumulator = {
  ticker: string;
  asset_name: string;
  shares: Decimal;
  buyShares: Decimal;
  buyTotal: Decimal;
};

async function loadInvestmentWallet(userId: string, walletId: string): Promise<void> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { user_id: true, type: true },
  });
  if (!wallet || wallet.user_id !== userId) throw new NotFoundError('Wallet not found');
  if (wallet.type !== 'INVESTMENT') {
    throw new ValidationError('Wallet must be of type INVESTMENT');
  }
}

function pct(numerator: Decimal, denominator: Decimal): Decimal {
  if (denominator.isZero()) return new Decimal(0);
  return numerator.div(denominator).mul(100).toDecimalPlaces(2);
}

export async function getPortfolio(userId: string, walletId: string): Promise<PortfolioResponse> {
  await loadInvestmentWallet(userId, walletId);

  const transactions = await prisma.investmentTransaction.findMany({
    where: { wallet_id: walletId },
    orderBy: { date: 'asc' },
  });

  const accumByTicker = new Map<string, PositionAccumulator>();
  for (const tx of transactions) {
    const acc = accumByTicker.get(tx.ticker) ?? {
      ticker: tx.ticker,
      asset_name: tx.asset_name,
      shares: new Decimal(0),
      buyShares: new Decimal(0),
      buyTotal: new Decimal(0),
    };
    if (tx.type === 'BUY') {
      acc.shares = acc.shares.add(tx.shares);
      acc.buyShares = acc.buyShares.add(tx.shares);
      acc.buyTotal = acc.buyTotal.add(tx.total_amount);
    } else if (tx.type === 'SELL') {
      acc.shares = acc.shares.sub(tx.shares);
    }
    // DIVIDEND no afecta shares ni avg_cost — solo informa de ingresos pasados.
    acc.asset_name = tx.asset_name;
    accumByTicker.set(tx.ticker, acc);
  }

  const openPositions = Array.from(accumByTicker.values()).filter((p) => p.shares.gt(0));

  const positions: PortfolioPosition[] = [];
  let totalValue = new Decimal(0);
  let totalCost = new Decimal(0);
  let oldestUpdate: Date | null = null;

  for (const p of openPositions) {
    const quote = await getOrRefreshPrice(p.ticker);
    const avgCost = p.buyShares.isZero() ? new Decimal(0) : p.buyTotal.div(p.buyShares);
    const cost = avgCost.mul(p.shares);
    const value = quote.price.mul(p.shares);
    const gain = value.sub(cost);

    totalValue = totalValue.add(value);
    totalCost = totalCost.add(cost);
    if (oldestUpdate === null || quote.last_updated.getTime() < oldestUpdate.getTime()) {
      oldestUpdate = quote.last_updated;
    }

    positions.push({
      ticker: p.ticker,
      asset_name: p.asset_name,
      shares: p.shares.toString(),
      avg_cost_per_share: avgCost.toDecimalPlaces(2).toString(),
      current_price: quote.price.toString(),
      currency: quote.currency,
      market_open: quote.market_open,
      value: value.toDecimalPlaces(2).toString(),
      cost: cost.toDecimalPlaces(2).toString(),
      gain: gain.toDecimalPlaces(2).toString(),
      gain_pct: pct(gain, cost).toString(),
    });
  }

  const totalGain = totalValue.sub(totalCost);
  return {
    positions,
    total_value: totalValue.toDecimalPlaces(2).toString(),
    total_cost: totalCost.toDecimalPlaces(2).toString(),
    total_gain: totalGain.toDecimalPlaces(2).toString(),
    total_gain_pct: pct(totalGain, totalCost).toString(),
    last_updated: (oldestUpdate ?? new Date()).toISOString(),
  };
}
