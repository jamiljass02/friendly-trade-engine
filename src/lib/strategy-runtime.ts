export type StrategyRuntimeSource = "builder" | "algo";
export type StrategyRuntimeMode = "paper" | "live";
export type StrategyRuntimeStatus = "running" | "paused";

export interface StrategyRuntimeLeg {
  symbol: string;
  instrument: string;
  type: "CE" | "PE" | "FUT" | "EQ";
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  strike?: number;
  expiry?: string;
}

export interface RunningStrategyRuntime {
  id: string;
  strategyId?: string;
  name: string;
  instrument: string;
  source: StrategyRuntimeSource;
  mode: StrategyRuntimeMode;
  status: StrategyRuntimeStatus;
  createdAt: string;
  legs: StrategyRuntimeLeg[];
}

const STORAGE_KEY = "tradex_running_strategies";
const UPDATE_EVENT = "strategy-runtime-updated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emitUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UPDATE_EVENT));
  }
}

export function getStrategyRuntimeUpdateEvent() {
  return UPDATE_EVENT;
}

export function listRunningStrategies(): RunningStrategyRuntime[] {
  if (!canUseStorage()) return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRunningStrategies(items: RunningStrategyRuntime[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  emitUpdate();
}

export function upsertRunningStrategy(item: RunningStrategyRuntime) {
  const items = listRunningStrategies();
  const next = [item, ...items.filter((existing) => existing.id !== item.id)].slice(0, 100);
  saveRunningStrategies(next);
}

export function removeRunningStrategy(id: string) {
  saveRunningStrategies(listRunningStrategies().filter((item) => item.id !== id));
}

export function updateRunningStrategyStatus(id: string, status: StrategyRuntimeStatus) {
  saveRunningStrategies(
    listRunningStrategies().map((item) => (item.id === id ? { ...item, status } : item))
  );
}

export function removeRunningStrategyByStrategyId(strategyId: string) {
  saveRunningStrategies(listRunningStrategies().filter((item) => item.strategyId !== strategyId));
}

export function updateRunningStrategyStatusByStrategyId(strategyId: string, status: StrategyRuntimeStatus) {
  saveRunningStrategies(
    listRunningStrategies().map((item) =>
      item.strategyId === strategyId ? { ...item, status } : item
    )
  );
}
