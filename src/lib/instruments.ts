/**
 * F&O Instrument definitions for Indian markets
 */

export interface IndexInstrument {
  symbol: string;
  name: string;
  exchange: string;
  spotToken: string;
  lotSize: number;
  tickSize: number;
  strikeStep: number;
  weeklyExpiry: boolean;
  type: "index";
}

export interface StockInstrument {
  symbol: string;
  name: string;
  exchange: string;
  lotSize: number;
  tickSize: number;
  strikeStep: number;
  type: "stock";
  industry?: string;
}

export type Instrument = IndexInstrument | StockInstrument;

export function parseBrokerLotSize(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getEffectiveLotSize(symbol: string, brokerLotSize?: unknown): number {
  return parseBrokerLotSize(brokerLotSize) ?? getInstrument(symbol)?.lotSize ?? 25;
}

// All F&O eligible indices
export const INDEX_INSTRUMENTS: IndexInstrument[] = [
  {
    symbol: "NIFTY",
    name: "Nifty 50",
    exchange: "NFO",
    spotToken: "26000",
    lotSize: 65,
    tickSize: 0.05,
    strikeStep: 50,
    weeklyExpiry: true,
    type: "index",
  },
  {
    symbol: "SENSEX",
    name: "Sensex",
    exchange: "BFO",
    spotToken: "1",
    lotSize: 20,
    tickSize: 0.05,
    strikeStep: 100,
    weeklyExpiry: true,
    type: "index",
  },
  {
    symbol: "BANKNIFTY",
    name: "Bank Nifty",
    exchange: "NFO",
    spotToken: "26009",
    lotSize: 30,
    tickSize: 0.05,
    strikeStep: 100,
    weeklyExpiry: false,
    type: "index",
  },
  {
    symbol: "FINNIFTY",
    name: "Fin Nifty",
    exchange: "NFO",
    spotToken: "26037",
    lotSize: 25,
    tickSize: 0.05,
    strikeStep: 50,
    weeklyExpiry: false,
    type: "index",
  },
  {
    symbol: "MIDCPNIFTY",
    name: "Midcap Nifty",
    exchange: "NFO",
    spotToken: "26074",
    lotSize: 50,
    tickSize: 0.05,
    strikeStep: 25,
    weeklyExpiry: false,
    type: "index",
  },
  {
    symbol: "BANKEX",
    name: "Bankex",
    exchange: "BFO",
    spotToken: "12",
    lotSize: 15,
    tickSize: 0.05,
    strikeStep: 100,
    weeklyExpiry: false,
    type: "index",
  },
];

// Curated F&O stock list (top stocks, updated periodically)
export const FNO_STOCKS: StockInstrument[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", exchange: "NFO", lotSize: 250, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Oil & Gas" },
  { symbol: "TCS", name: "Tata Consultancy Services", exchange: "NFO", lotSize: 150, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "IT" },
  { symbol: "HDFCBANK", name: "HDFC Bank", exchange: "NFO", lotSize: 550, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Banking" },
  { symbol: "INFY", name: "Infosys", exchange: "NFO", lotSize: 300, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "IT" },
  { symbol: "ICICIBANK", name: "ICICI Bank", exchange: "NFO", lotSize: 700, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Banking" },
  { symbol: "SBIN", name: "State Bank of India", exchange: "NFO", lotSize: 750, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "Banking" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", exchange: "NFO", lotSize: 475, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Telecom" },
  { symbol: "ITC", name: "ITC Limited", exchange: "NFO", lotSize: 1600, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "FMCG" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", exchange: "NFO", lotSize: 400, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Banking" },
  { symbol: "LT", name: "Larsen & Toubro", exchange: "NFO", lotSize: 150, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Infra" },
  { symbol: "AXISBANK", name: "Axis Bank", exchange: "NFO", lotSize: 625, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Banking" },
  { symbol: "TATAMOTORS", name: "Tata Motors", exchange: "NFO", lotSize: 575, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "Auto" },
  { symbol: "MARUTI", name: "Maruti Suzuki", exchange: "NFO", lotSize: 100, tickSize: 0.05, strikeStep: 50, type: "stock", industry: "Auto" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", exchange: "NFO", lotSize: 350, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Pharma" },
  { symbol: "TATASTEEL", name: "Tata Steel", exchange: "NFO", lotSize: 5500, tickSize: 0.05, strikeStep: 2, type: "stock", industry: "Metals" },
  { symbol: "WIPRO", name: "Wipro", exchange: "NFO", lotSize: 1500, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "IT" },
  { symbol: "HCLTECH", name: "HCL Technologies", exchange: "NFO", lotSize: 350, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "IT" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", exchange: "NFO", lotSize: 125, tickSize: 0.05, strikeStep: 50, type: "stock", industry: "NBFC" },
  { symbol: "POWERGRID", name: "Power Grid Corp", exchange: "NFO", lotSize: 2700, tickSize: 0.05, strikeStep: 2, type: "stock", industry: "Power" },
  { symbol: "NTPC", name: "NTPC Limited", exchange: "NFO", lotSize: 2100, tickSize: 0.05, strikeStep: 2, type: "stock", industry: "Power" },
  { symbol: "ONGC", name: "ONGC", exchange: "NFO", lotSize: 3250, tickSize: 0.05, strikeStep: 2, type: "stock", industry: "Oil & Gas" },
  { symbol: "COALINDIA", name: "Coal India", exchange: "NFO", lotSize: 1500, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "Mining" },
  { symbol: "ADANIENT", name: "Adani Enterprises", exchange: "NFO", lotSize: 250, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Conglomerate" },
  { symbol: "TECHM", name: "Tech Mahindra", exchange: "NFO", lotSize: 400, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "IT" },
  { symbol: "M&M", name: "Mahindra & Mahindra", exchange: "NFO", lotSize: 350, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Auto" },
  { symbol: "TITAN", name: "Titan Company", exchange: "NFO", lotSize: 175, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Consumer" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", exchange: "NFO", lotSize: 50, tickSize: 0.05, strikeStep: 50, type: "stock", industry: "Cement" },
  { symbol: "ASIANPAINT", name: "Asian Paints", exchange: "NFO", lotSize: 300, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "Paints" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", exchange: "NFO", lotSize: 300, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "FMCG" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv", exchange: "NFO", lotSize: 500, tickSize: 0.05, strikeStep: 10, type: "stock", industry: "NBFC" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Labs", exchange: "NFO", lotSize: 125, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Pharma" },
  { symbol: "CIPLA", name: "Cipla", exchange: "NFO", lotSize: 650, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "Pharma" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories", exchange: "NFO", lotSize: 100, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Pharma" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals", exchange: "NFO", lotSize: 125, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Healthcare" },
  { symbol: "JSWSTEEL", name: "JSW Steel", exchange: "NFO", lotSize: 675, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "Metals" },
  { symbol: "TATACONSUM", name: "Tata Consumer", exchange: "NFO", lotSize: 500, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "FMCG" },
  { symbol: "NESTLEIND", name: "Nestle India", exchange: "NFO", lotSize: 200, tickSize: 0.05, strikeStep: 25, type: "stock", industry: "FMCG" },
  { symbol: "EICHERMOT", name: "Eicher Motors", exchange: "NFO", lotSize: 125, tickSize: 0.05, strikeStep: 25, type: "stock", industry: "Auto" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank", exchange: "NFO", lotSize: 500, tickSize: 0.05, strikeStep: 5, type: "stock", industry: "Banking" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp", exchange: "NFO", lotSize: 150, tickSize: 0.05, strikeStep: 20, type: "stock", industry: "Auto" },
];

export function getInstrument(symbol: string): Instrument | undefined {
  return (
    INDEX_INSTRUMENTS.find((i) => i.symbol === symbol) ||
    FNO_STOCKS.find((s) => s.symbol === symbol)
  );
}

export function getDefaultSpotPrice(symbol: string): number {
  const spotDefaults: Record<string, number> = {
    NIFTY: 24670,
    BANKNIFTY: 55200,
    FINNIFTY: 25200,
    MIDCPNIFTY: 13100,
    SENSEX: 81200,
    BANKEX: 58500,
    RELIANCE: 1280,
    TCS: 3450,
    HDFCBANK: 1870,
    INFY: 1520,
    ICICIBANK: 1370,
    SBIN: 790,
    BHARTIARTL: 1750,
    ITC: 410,
    KOTAKBANK: 1950,
    LT: 3350,
    AXISBANK: 1150,
    TATAMOTORS: 650,
    MARUTI: 12200,
    SUNPHARMA: 1750,
    TATASTEEL: 150,
    WIPRO: 310,
    HCLTECH: 1650,
    BAJFINANCE: 9200,
  };
  return spotDefaults[symbol] || 1000;
}
