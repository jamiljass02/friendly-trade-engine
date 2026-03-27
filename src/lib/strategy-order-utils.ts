import { formatExpiryForSymbol, getUpcomingExpiries } from "@/lib/expiry-utils";
import { getInstrument } from "@/lib/instruments";

interface ResolveOptionTradingSymbolParams {
  instrument: string;
  optionType: "CE" | "PE";
  strike: number;
  expiryDate?: Date;
  exchange?: string;
  strict?: boolean;
  getOptionChain: (symbol: string, strikePrice: number, count?: number, exchange?: string) => Promise<any>;
  searchScrip: (searchText: string, exchange?: string) => Promise<any>;
}

export function resolveBuilderExpiryDate(expiryLabel: string, instrument: string): Date | undefined {
  const inst = getInstrument(instrument);
  const isWeekly = inst?.type === "index" ? (inst as any).weeklyExpiry : false;
  const expiries = getUpcomingExpiries(isWeekly, 12, instrument);
  return expiries.find((expiry) => expiry.label === expiryLabel)?.date ?? expiries[0]?.date;
}

export function resolveAlgoExpiryDate(
  expiry: "current_week" | "next_week" | "current_month" | "next_month" | "far_month" | "custom",
  instrument: string,
  customExpiry?: string
): Date | undefined {
  if (expiry === "custom" && customExpiry) {
    const parsed = new Date(customExpiry);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const inst = getInstrument(instrument);
  const isWeekly = inst?.type === "index" ? (inst as any).weeklyExpiry : false;
  const expiries = getUpcomingExpiries(isWeekly, 12, instrument);
  const monthlyExpiries = expiries.filter((item) => item.isMonthly);
  const weeklyExpiries = expiries.filter((item) => item.isWeekly);

  switch (expiry) {
    case "current_week":
      return weeklyExpiries[0]?.date ?? expiries[0]?.date;
    case "next_week":
      return weeklyExpiries[1]?.date ?? weeklyExpiries[0]?.date ?? expiries[1]?.date ?? expiries[0]?.date;
    case "current_month":
      return monthlyExpiries[0]?.date ?? expiries[0]?.date;
    case "next_month":
      return monthlyExpiries[1]?.date ?? monthlyExpiries[0]?.date ?? expiries[1]?.date ?? expiries[0]?.date;
    case "far_month":
      return monthlyExpiries[2]?.date ?? monthlyExpiries[1]?.date ?? monthlyExpiries[0]?.date ?? expiries[2]?.date ?? expiries[0]?.date;
    default:
      return expiries[0]?.date;
  }
}

export function buildPaperOptionSymbol(params: {
  instrument: string;
  expiryDate?: Date;
  strike: number;
  optionType: "CE" | "PE";
}) {
  const expiryCode = params.expiryDate ? formatExpiryForSymbol(params.expiryDate) : "SPOT";
  return `${params.instrument} ${expiryCode} ${params.strike} ${params.optionType}`;
}

export async function resolveOptionTradingSymbol({
  instrument,
  optionType,
  strike,
  expiryDate,
  exchange,
  strict = false,
  getOptionChain,
  searchScrip,
}: ResolveOptionTradingSymbolParams): Promise<string> {
  const resolvedExchange = exchange || getInstrument(instrument)?.exchange || "NFO";
  const expiryCode = expiryDate ? formatExpiryForSymbol(expiryDate) : null;

  const normalizeOptionType = (value: unknown): "CE" | "PE" | null => {
    const normalized = String(value ?? "").trim().toUpperCase();
    if (["CE", "C", "CALL"].includes(normalized)) return "CE";
    if (["PE", "P", "PUT"].includes(normalized)) return "PE";
    return null;
  };

  const normalizeTradingSymbol = (value: unknown) => String(value ?? "").trim().toUpperCase();

  // Build multiple candidate symbols to try (Shoonya format: NIFTY31MAR26C24250)
  const ceSuffix = optionType === "CE" ? "C" : "P";
  const candidates = expiryCode
    ? [
        `${instrument}${expiryCode}${ceSuffix}${strike}`,
        `${instrument}${expiryCode}${optionType}${strike}`,
      ]
    : [
        `${instrument}${ceSuffix}${strike}`,
        `${instrument}${optionType}${strike}`,
      ];

  let tradingSymbol = candidates[0];

  // Helper: match a row from option chain / search results
  const matchRow = (row: any): boolean => {
    const rowStrike = Number(row.strprc ?? row.strike ?? row.strike_price ?? row.dname?.match(/(\d+(?:\.\d+)?)/)?.[1]);
    const rowTsym = normalizeTradingSymbol(row.tsym ?? row.tradingsymbol ?? row.token_tsym ?? row.symbol);
    const rowType = normalizeOptionType(row.optt ?? row.option_type ?? row.instname ?? row.instrument);
    const strikeMatch = Number.isFinite(rowStrike) ? Math.abs(rowStrike - strike) < 0.01 : rowTsym.includes(String(strike));
    const typeMatch = rowType ? rowType === optionType : rowTsym.includes(optionType) || rowTsym.endsWith(`${ceSuffix}${strike}`) || rowTsym.includes(`${ceSuffix}${strike}`);
    const expiryMatches = expiryCode ? rowTsym.includes(expiryCode) : true;
    return strikeMatch && typeMatch && expiryMatches && !!row.tsym;
  };

  const pickTradingSymbol = (row: any): string | null => {
    const raw = row?.tsym ?? row?.tradingsymbol ?? row?.token_tsym ?? row?.symbol;
    const value = String(raw ?? "").trim();
    return value ? value : null;
  };

  const extractValues = (result: any): any[] =>
    Array.isArray((result as any)?.values) ? (result as any).values
      : Array.isArray(result) ? result : [];

  // 1. Try option chain first — Shoonya requires futures symbol as tsym (e.g. NIFTY31MAR26F)
  const futuresSymbol = expiryCode ? `${instrument}${expiryCode}F` : instrument;
  try {
    console.log(`[SymbolResolve] Trying option chain with futuresSymbol=${futuresSymbol}, strike=${strike}`);
    const chainResult = await getOptionChain(futuresSymbol, strike, 12, resolvedExchange);
    const values = extractValues(chainResult);
    console.log(`[SymbolResolve] Option chain returned ${values.length} rows`);
    if (values.length > 0) {
      console.log(`[SymbolResolve] Sample row tsym: ${values[0]?.tsym}, optt: ${values[0]?.optt}, strprc: ${values[0]?.strprc}`);
    }
    const exact = values.find(matchRow);
    const exactSymbol = exact ? pickTradingSymbol(exact) : null;
    if (exactSymbol) {
      console.log(`[SymbolResolve] Matched from option chain: ${exactSymbol}`);
      return exactSymbol;
    }
  } catch (e) {
    console.warn(`[SymbolResolve] Option chain failed for ${futuresSymbol}:`, e);
  }

  // 2. Try search with multiple queries
  const searchQueries = [
    ...candidates,
    `${instrument} ${strike} ${optionType}`,
    `${instrument}${strike}${optionType}`,
  ];

  for (const query of searchQueries) {
    try {
      const searchResult = await searchScrip(query, resolvedExchange);
      const values = extractValues(searchResult);
      const exact = values.find(matchRow);
      const exactSymbol = exact ? pickTradingSymbol(exact) : null;
      if (exactSymbol) {
        tradingSymbol = exactSymbol;
        console.log(`[SymbolResolve] Matched: ${tradingSymbol} from query: ${query}`);
        return tradingSymbol;
      }
    } catch {
      // continue
    }
  }

  if (strict) {
    throw new Error(`Unable to resolve valid trading symbol for ${instrument} ${optionType} ${strike}`);
  }

  console.warn(`[SymbolResolve] No match found for ${instrument} ${optionType} ${strike}, using fallback: ${tradingSymbol}`);
  return tradingSymbol;
}
