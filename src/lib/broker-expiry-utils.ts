import { format } from "date-fns";
import { formatExpiryForSymbol, type ExpiryDate } from "@/lib/expiry-utils";
import { parseBrokerLotSize } from "@/lib/instruments";

const MONTH_INDEX: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

const normalizeText = (value: unknown) => String(value ?? "").trim().toUpperCase();

function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function buildDate(year: number, monthIndex: number, day: number): Date | null {
  const date = new Date(year, monthIndex, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return normalizeDate(date);
}

function parseDayMonthYear(dayText: string, monthText: string, yearText: string): Date | null {
  const day = Number.parseInt(dayText, 10);
  const monthIndex = MONTH_INDEX[monthText];
  const rawYear = Number.parseInt(yearText, 10);
  const year = yearText.length === 2 ? 2000 + rawYear : rawYear;

  if (!Number.isFinite(day) || monthIndex === undefined || !Number.isFinite(year)) {
    return null;
  }

  return buildDate(year, monthIndex, day);
}

export function parseBrokerExpiryDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return normalizeDate(value);
  }

  const text = normalizeText(value);
  if (!text) return null;

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsed = buildDate(Number.parseInt(iso[1], 10), Number.parseInt(iso[2], 10) - 1, Number.parseInt(iso[3], 10));
    if (parsed) return parsed;
  }

  const slash = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slash) {
    const year = slash[3].length === 2 ? 2000 + Number.parseInt(slash[3], 10) : Number.parseInt(slash[3], 10);
    const parsed = buildDate(year, Number.parseInt(slash[2], 10) - 1, Number.parseInt(slash[1], 10));
    if (parsed) return parsed;
  }

  const monthPattern = Object.keys(MONTH_INDEX).join("|");
  const compact = text.replace(/[^A-Z0-9]/g, "");
  const compactMatch = compact.match(new RegExp(`(\\d{1,2})(${monthPattern})(\\d{2,4})`));
  if (compactMatch) {
    const parsed = parseDayMonthYear(compactMatch[1], compactMatch[2], compactMatch[3]);
    if (parsed) return parsed;
  }

  const spacedMatch = text.replace(/[-_]/g, " ").match(new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{2,4})`));
  if (spacedMatch) {
    const parsed = parseDayMonthYear(spacedMatch[1], spacedMatch[2], spacedMatch[3]);
    if (parsed) return parsed;
  }

  const native = new Date(text.replace(/-/g, " "));
  if (!Number.isNaN(native.getTime())) {
    return normalizeDate(native);
  }

  return null;
}

function normalizeOptionType(value: unknown): "CE" | "PE" | null {
  const normalized = normalizeText(value);
  if (["CE", "C", "CALL"].includes(normalized)) return "CE";
  if (["PE", "P", "PUT"].includes(normalized)) return "PE";
  return null;
}

function pickTradingSymbol(row: any): string | null {
  const raw = row?.tsym ?? row?.tradingsymbol ?? row?.token_tsym ?? row?.symbol;
  const value = String(raw ?? "").trim();
  return value || null;
}

export function extractBrokerValues(result: any): any[] {
  if (Array.isArray(result?.values)) return result.values;
  if (Array.isArray(result)) return result;
  return [];
}

export interface BrokerResolvedExpiry extends ExpiryDate {
  symbolCode: string;
  lotSize?: number;
}

export function collectBrokerExpiries(rows: any[], instrument: string): BrokerResolvedExpiry[] {
  const symbol = normalizeText(instrument);
  const today = normalizeDate(new Date());
  const unique = new Map<string, BrokerResolvedExpiry>();

  for (const row of rows) {
    const tradingSymbol = pickTradingSymbol(row);
    if (!tradingSymbol) continue;

    const normalizedSymbol = normalizeText(tradingSymbol);
    if (!normalizedSymbol.startsWith(symbol)) continue;

    const optionType = normalizeOptionType(row?.optt ?? row?.option_type ?? row?.instname ?? row?.instrument);
    if (!optionType && !normalizedSymbol.includes("CE") && !normalizedSymbol.includes("PE") && !normalizedSymbol.includes("C") && !normalizedSymbol.includes("P")) {
      continue;
    }

    const expiryDate = parseBrokerExpiryDate(row?.exd ?? row?.expiry ?? row?.exp_date ?? tradingSymbol);
    if (!expiryDate || expiryDate.getTime() < today.getTime()) continue;

    const symbolCode = formatExpiryForSymbol(expiryDate);
    if (unique.has(symbolCode)) continue;

    unique.set(symbolCode, {
      date: expiryDate,
      label: format(expiryDate, "d MMM"),
      fullLabel: format(expiryDate, "d MMM yyyy"),
      isWeekly: true,
      isMonthly: false,
      isCurrent: false,
      isNext: false,
      isFar: false,
      symbolCode,
      lotSize: parseBrokerLotSize(row?.ls ?? row?.lotsize ?? row?.lot_size ?? row?.qty) ?? undefined,
    });
  }

  const expiries = Array.from(unique.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  const lastExpiryPerMonth = new Map<string, number>();

  for (const expiry of expiries) {
    lastExpiryPerMonth.set(`${expiry.date.getFullYear()}-${expiry.date.getMonth()}`, expiry.date.getTime());
  }

  return expiries.map((expiry, index) => {
    const monthKey = `${expiry.date.getFullYear()}-${expiry.date.getMonth()}`;
    const isMonthly = lastExpiryPerMonth.get(monthKey) === expiry.date.getTime();

    return {
      ...expiry,
      isWeekly: !isMonthly,
      isMonthly,
      isCurrent: index === 0,
      isNext: index === 1,
      isFar: index === 2,
    };
  });
}

export async function fetchBrokerOptionExpiries(params: {
  instrument: string;
  exchange?: string;
  searchScrip: (searchText: string, exchange?: string) => Promise<any>;
}): Promise<BrokerResolvedExpiry[]> {
  const { instrument, exchange, searchScrip } = params;
  const queries = Array.from(new Set([
    instrument,
    `${instrument} CE`,
    `${instrument} PE`,
    `${instrument} OPT`,
    `${instrument} C`,
    `${instrument} P`,
  ]));

  const rows: any[] = [];

  for (const query of queries) {
    try {
      rows.push(...extractBrokerValues(await searchScrip(query, exchange)));
      const expiries = collectBrokerExpiries(rows, instrument);
      if (expiries.length >= 8) return expiries.slice(0, 8);
    } catch (error) {
      console.warn(`[BrokerExpiry] Failed to fetch expiries for ${instrument} with query "${query}"`, error);
    }
  }

  return collectBrokerExpiries(rows, instrument).slice(0, 8);
}