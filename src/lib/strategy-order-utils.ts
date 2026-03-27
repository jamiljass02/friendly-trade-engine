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

export interface ResolvedOptionContract {
  tradingSymbol: string;
  lotSize?: number;
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

function parseStrikeFromText(value: unknown): number | null {
  const matches = String(value ?? "").match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const parsed = Number(matches[i]);
    if (Number.isFinite(parsed) && parsed >= 100) return parsed;
  }

  const fallback = Number(matches[matches.length - 1]);
  return Number.isFinite(fallback) ? fallback : null;
}

function parseRowLotSize(row: any): number | undefined {
  const candidates = [row?.ls, row?.lotsize, row?.lot_size, row?.qty];
  for (const candidate of candidates) {
    const parsed = Number.parseInt(String(candidate ?? "").trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function normalizeExpiryDateText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatExpiryForSymbol(parsed);
}

export async function resolveOptionContract({
  instrument,
  optionType,
  strike,
  expiryDate,
  exchange,
  strict = false,
  getOptionChain,
  searchScrip,
}: ResolveOptionTradingSymbolParams): Promise<ResolvedOptionContract> {
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
  let resolvedLotSize: number | undefined;

  // Helper: match a row from option chain / search results
  const matchRow = (row: any): boolean => {
    const rowStrike = Number(
      row.strprc ??
      row.strike ??
      row.strike_price ??
      parseStrikeFromText(row.dname) ??
      parseStrikeFromText(row.tsym ?? row.tradingsymbol ?? row.token_tsym ?? row.symbol)
    );
    const rowTsym = normalizeTradingSymbol(row.tsym ?? row.tradingsymbol ?? row.token_tsym ?? row.symbol);
    const rowType = normalizeOptionType(row.optt ?? row.option_type ?? row.instname ?? row.instrument);
    const strikeMatch = Number.isFinite(rowStrike) ? Math.abs(rowStrike - strike) < 0.01 : rowTsym.includes(String(strike));
    const typeMatch = rowType ? rowType === optionType : rowTsym.includes(optionType) || rowTsym.endsWith(`${ceSuffix}${strike}`) || rowTsym.includes(`${ceSuffix}${strike}`);
    const rowExpiry = normalizeExpiryDateText(row.exd ?? row.expiry ?? row.exp_date);
    const expiryMatches = expiryCode ? rowTsym.includes(expiryCode) || rowExpiry === expiryCode : true;
    return strikeMatch && typeMatch && expiryMatches && !!pickTradingSymbol(row);
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
      resolvedLotSize = parseRowLotSize(exact);
      console.log(`[SymbolResolve] Matched from option chain: ${exactSymbol}`);
      return { tradingSymbol: exactSymbol, lotSize: resolvedLotSize };
    }
  } catch (e) {
    console.warn(`[SymbolResolve] Option chain failed for ${futuresSymbol}:`, e);
  }

  // 2. Try search with multiple queries (Shoonya SearchScrip uses partial text matching)
  const readableExpiry = expiryDate
    ? expiryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).replace(/\s+/g, " ").toUpperCase()
    : null;
  const searchQueries = Array.from(new Set([
    ...candidates,
    expiryCode ? `${instrument}${expiryCode}${ceSuffix}` : `${instrument}${ceSuffix}${strike}`,
    expiryCode ? `${instrument} ${expiryCode} ${optionType} ${strike}` : `${instrument} ${optionType} ${strike}`,
    readableExpiry ? `${instrument} ${readableExpiry} ${optionType} ${strike}` : `${instrument} ${optionType} ${strike}`,
    `${instrument} ${strike} ${optionType}`,
    `${instrument} ${optionType} ${strike}`,
  ]));

  for (const query of searchQueries) {
    try {
      console.log(`[SymbolResolve] Searching: "${query}" on ${resolvedExchange}`);
      const searchResult = await searchScrip(query, resolvedExchange);
      const values = extractValues(searchResult);
      console.log(`[SymbolResolve] Search returned ${values.length} results for "${query}"`);
      if (values.length > 0 && values.length <= 5) {
        console.log(`[SymbolResolve] Results:`, values.map((v: any) => v.tsym).join(", "));
      }
      const exact = values.find(matchRow);
      const exactSymbol = exact ? pickTradingSymbol(exact) : null;
      if (exactSymbol) {
        tradingSymbol = exactSymbol;
        resolvedLotSize = parseRowLotSize(exact);
        console.log(`[SymbolResolve] ✓ Matched: ${tradingSymbol} from query: ${query}`);
        return { tradingSymbol, lotSize: resolvedLotSize };
      }
    } catch (e) {
      console.warn(`[SymbolResolve] Search failed for "${query}":`, e);
    }
  }

  if (strict) {
    throw new Error(`Unable to resolve valid trading symbol for ${instrument} ${optionType} ${strike}`);
  }

  console.warn(`[SymbolResolve] No match found for ${instrument} ${optionType} ${strike}, using fallback: ${tradingSymbol}`);
  return { tradingSymbol, lotSize: resolvedLotSize };
}

export async function resolveOptionTradingSymbol(params: ResolveOptionTradingSymbolParams): Promise<string> {
  const contract = await resolveOptionContract(params);
  return contract.tradingSymbol;
}
