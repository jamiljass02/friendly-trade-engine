import { useMemo } from "react";

export interface BacktestCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestResult {
  date: string;
  pnl: number;
  cumulativePnl: number;
  premium: number;
  maxDrawdown: number;
  tradeCount: number;
}

export interface BacktestSummary {
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgPremium: number;
  profitFactor: number;
  maxConsecutiveLosses: number;
  results: BacktestResult[];
}

// Generate synthetic historical data for backtesting
function generateHistoricalData(
  instrument: string,
  days: number,
  basePrice: number
): BacktestCandle[] {
  const candles: BacktestCandle[] = [];
  let price = basePrice;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dailyReturn = (Math.random() - 0.48) * 0.02; // slight positive bias
    const volatility = 0.01 + Math.random() * 0.015;

    const open = price;
    const intraHigh = open * (1 + volatility * Math.random());
    const intraLow = open * (1 - volatility * Math.random());
    const close = open * (1 + dailyReturn);

    price = close;

    candles.push({
      date: date.toISOString().split("T")[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(Math.max(open, close, intraHigh) * 100) / 100,
      low: Math.round(Math.min(open, close, intraLow) * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(500000 + Math.random() * 2000000),
    });
  }

  return candles;
}

// Simulate a strategy over historical data
function simulateStrategy(
  candles: BacktestCandle[],
  strategy: string,
  quantity: number,
  stopLossPct: number
): BacktestSummary {
  const results: BacktestResult[] = [];
  let cumulativePnl = 0;
  let maxPeak = 0;
  let maxDrawdown = 0;
  let wins = 0;
  let losses = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;
  let totalPremium = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  const dailyReturns: number[] = [];

  for (const candle of candles) {
    const spot = candle.close;
    const iv = 0.12 + Math.random() * 0.08; // 12-20% IV
    const dailyVol = spot * iv / Math.sqrt(252);

    let pnl = 0;
    let premium = 0;

    switch (strategy) {
      case "straddle": {
        // Short straddle: sell ATM CE + PE
        premium = dailyVol * 1.5 * 2; // approximate premium
        const move = Math.abs(candle.high - candle.low);
        const breakeven = premium;
        pnl = (premium - Math.max(0, move - breakeven * 0.5)) * quantity;
        break;
      }
      case "strangle": {
        premium = dailyVol * 0.8 * 2;
        const move2 = Math.abs(candle.close - candle.open);
        pnl = (premium - Math.max(0, move2 - premium * 1.2)) * quantity;
        break;
      }
      case "iron_condor": {
        premium = dailyVol * 0.6 * 2;
        const range = candle.high - candle.low;
        const width = spot * 0.02;
        pnl = range < width ? premium * quantity : (premium - (range - width) * 0.5) * quantity;
        break;
      }
      case "calendar_spread": {
        premium = dailyVol * 0.3;
        const thetaDecay = premium * 0.05;
        pnl = thetaDecay * quantity * (Math.random() > 0.3 ? 1 : -0.5);
        break;
      }
      default: {
        premium = dailyVol;
        pnl = (Math.random() - 0.45) * premium * quantity;
      }
    }

    // Apply stop loss
    const maxLoss = -premium * quantity * (stopLossPct / 100);
    if (pnl < maxLoss) pnl = maxLoss;

    pnl = Math.round(pnl);
    cumulativePnl += pnl;
    totalPremium += premium;

    if (cumulativePnl > maxPeak) maxPeak = cumulativePnl;
    const drawdown = maxPeak - cumulativePnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (pnl >= 0) {
      wins++;
      consecutiveLosses = 0;
      grossProfit += pnl;
    } else {
      losses++;
      consecutiveLosses++;
      if (consecutiveLosses > maxConsecutiveLosses)
        maxConsecutiveLosses = consecutiveLosses;
      grossLoss += Math.abs(pnl);
    }

    dailyReturns.push(pnl);

    results.push({
      date: candle.date,
      pnl,
      cumulativePnl,
      premium: Math.round(premium * 100) / 100,
      maxDrawdown,
      tradeCount: wins + losses,
    });
  }

  const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const stdDev = Math.sqrt(
    dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
  );
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    totalPnl: cumulativePnl,
    totalTrades: wins + losses,
    winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    maxDrawdown: Math.round(maxDrawdown),
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    avgPremium: Math.round((totalPremium / candles.length) * 100) / 100,
    profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 999 : 0,
    maxConsecutiveLosses,
    results,
  };
}

export interface StressScenario {
  name: string;
  description: string;
  spotChange: number; // percentage
  ivMultiplier: number;
  liquidityFactor: number; // 0 to 1
}

export interface StressResult {
  scenario: string;
  portfolioImpact: number;
  positionImpacts: {
    symbol: string;
    impact: number;
    newPrice: number;
  }[];
  marginImpact: number;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export const defaultScenarios: StressScenario[] = [
  {
    name: "Flash Crash (-5%)",
    description: "Sudden market drop of 5% within minutes",
    spotChange: -5,
    ivMultiplier: 2.5,
    liquidityFactor: 0.3,
  },
  {
    name: "Black Swan (-10%)",
    description: "Extreme market crash of 10%, circuit breaker levels",
    spotChange: -10,
    ivMultiplier: 3.5,
    liquidityFactor: 0.1,
  },
  {
    name: "Volatility Spike (VIX 2x)",
    description: "India VIX doubles, option premiums explode",
    spotChange: -2,
    ivMultiplier: 2.0,
    liquidityFactor: 0.6,
  },
  {
    name: "Volatility Spike (VIX 3x)",
    description: "India VIX triples, extreme premium expansion",
    spotChange: -3,
    ivMultiplier: 3.0,
    liquidityFactor: 0.4,
  },
  {
    name: "Gap Up +3%",
    description: "Overnight gap up due to global rally",
    spotChange: 3,
    ivMultiplier: 1.3,
    liquidityFactor: 0.7,
  },
  {
    name: "Gap Down -3%",
    description: "Overnight gap down due to geopolitical event",
    spotChange: -3,
    ivMultiplier: 1.8,
    liquidityFactor: 0.5,
  },
  {
    name: "Liquidity Dry-Up",
    description: "Extreme bid-ask widening, partial fills only",
    spotChange: -1,
    ivMultiplier: 1.5,
    liquidityFactor: 0.15,
  },
  {
    name: "Budget Day Volatility",
    description: "Union Budget announcement with high uncertainty",
    spotChange: 0,
    ivMultiplier: 2.2,
    liquidityFactor: 0.5,
  },
];

export function useBacktesting() {
  const runBacktest = (config: {
    instrument: string;
    strategy: string;
    days: number;
    quantity: number;
    stopLossPct: number;
  }): BacktestSummary => {
    const basePrices: Record<string, number> = {
      NIFTY: 24500,
      BANKNIFTY: 52000,
      SENSEX: 80000,
      RELIANCE: 2850,
      TCS: 4200,
      HDFCBANK: 1680,
    };

    const basePrice = basePrices[config.instrument] || 24500;
    const candles = generateHistoricalData(config.instrument, config.days, basePrice);
    return simulateStrategy(candles, config.strategy, config.quantity, config.stopLossPct);
  };

  const runStressTest = (
    positions: { symbol: string; side: "BUY" | "SELL"; quantity: number; price: number; type: string }[],
    scenario: StressScenario
  ): StressResult => {
    let totalImpact = 0;
    let marginImpact = 0;

    const positionImpacts = positions.map((p) => {
      let impact: number;
      const spotMove = p.price * (scenario.spotChange / 100);

      if (p.type === "CE" || p.type === "PE") {
        // Options: affected by both spot move and IV change
        const delta = p.type === "CE" ? 0.5 : -0.5;
        const vega = p.price * 0.01;
        const ivImpact = vega * (scenario.ivMultiplier - 1) * 20; // 20 = IV points change proxy

        impact = delta * spotMove * p.quantity + ivImpact * p.quantity;
        if (p.side === "SELL") impact = -impact;
      } else {
        // Futures/equity: direct spot impact
        impact = spotMove * p.quantity;
        if (p.side === "SELL") impact = -impact;
      }

      // Liquidity impact (slippage)
      const slippage = Math.abs(impact) * (1 - scenario.liquidityFactor) * 0.1;
      impact -= slippage;

      const newPrice = p.price * (1 + scenario.spotChange / 100);
      marginImpact += Math.abs(impact) * 0.2; // margin increase

      totalImpact += impact;

      return {
        symbol: p.symbol,
        impact: Math.round(impact),
        newPrice: Math.round(newPrice * 100) / 100,
      };
    });

    const absImpactPct = positions.length > 0
      ? Math.abs(totalImpact) / positions.reduce((s, p) => s + p.price * p.quantity, 1) * 100
      : 0;

    let riskLevel: "low" | "medium" | "high" | "critical" = "low";
    if (absImpactPct > 20) riskLevel = "critical";
    else if (absImpactPct > 10) riskLevel = "high";
    else if (absImpactPct > 5) riskLevel = "medium";

    return {
      scenario: scenario.name,
      portfolioImpact: Math.round(totalImpact),
      positionImpacts,
      marginImpact: Math.round(marginImpact),
      riskLevel,
    };
  };

  return { runBacktest, runStressTest };
}
