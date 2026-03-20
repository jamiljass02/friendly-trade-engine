import { formatExpiryForSymbol, getUpcomingExpiries } from "@/lib/expiry-utils";
import { getInstrument } from "@/lib/instruments";

interface ResolveOptionTradingSymbolParams {
  instrument: string;
  optionType: "CE" | "PE";
  strike: number;
  expiryDate?: Date;
  exchange?: string;
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
  getOptionChain,
  searchScrip,
}: ResolveOptionTradingSymbolParams): Promise<string> {
  const resolvedExchange = exchange || getInstrument(instrument)?.exchange || "NFO";
  const expiryCode = expiryDate ? formatExpiryForSymbol(expiryDate) : null;

  // Build multiple candidate symbols to try (different broker formats)
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
    const rowStrike = Number(row.strprc ?? row.strike);
    const rowType = String(row.optt ?? "").toUpperCase();
    const rowTsym = String(row.tsym ?? "");
    const strikeMatch = Number.isFinite(rowStrike) ? rowStrike === strike : rowTsym.includes(String(strike));
    const typeMatch = rowType ? rowType === optionType : rowTsym.includes(optionType);
    const expiryMatches = expiryCode ? rowTsym.includes(expiryCode) : true;
    return strikeMatch && typeMatch && expiryMatches && !!row.tsym;
  };

  const extractValues = (result: any): any[] =>
    Array.isArray((result as any)?.values) ? (result as any).values
      : Array.isArray(result) ? result : [];

  // 1. Try option chain first
  try {
    const chainResult = await getOptionChain(instrument, strike, 12, resolvedExchange);
    const values = extractValues(chainResult);
    const exact = values.find(matchRow);
    if (exact?.tsym) return String(exact.tsym);
  } catch {
    // fall through
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
      if (exact?.tsym) {
        tradingSymbol = String(exact.tsym);
        console.log(`[SymbolResolve] Matched: ${tradingSymbol} from query: ${query}`);
        return tradingSymbol;
      }
    } catch {
      // continue
    }
  }

  console.warn(`[SymbolResolve] No match found for ${instrument} ${optionType} ${strike}, using fallback: ${tradingSymbol}`);
  return tradingSymbol;
}
