import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Play,
  Pause,
  Plus,
  Clock,
  TrendingUp,
  TrendingDown,
  Shield,
  Trash2,
  Bell,
  BellOff,
  Target,
  Percent,
  Loader2,
  CalendarDays,
  RefreshCw,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Timer,
  Repeat,
  Settings2,
  Zap,
  Copy,
  BarChart3,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  PlusCircle,
  MinusCircle,
  Activity,
  Eye,
  Rocket,
  History,
  BookOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduledTrades } from "@/hooks/useScheduledTrades";
import { useBroker } from "@/hooks/useBroker";
import { getUpcomingExpiries, getDaysToExpiry } from "@/lib/expiry-utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useBacktesting, type BacktestSummary } from "@/hooks/useBacktesting";

// ── Types ──
interface StrategyLeg {
  id: string;
  segment: "OPT" | "FUT";
  side: "BUY" | "SELL";
  optionType: "CE" | "PE";
  strikeSelection: "ATM" | "ATM+1" | "ATM+2" | "ATM+3" | "ATM-1" | "ATM-2" | "ATM-3" | "CUSTOM";
  customStrike?: number;
  lots: number;
  expiry: "current" | "next" | "far";
}

interface EntryCondition {
  id: string;
  type: "time" | "premium" | "indicator" | "price_move" | "iv" | "oi_change";
  operator: ">" | "<" | "=" | ">=" | "<=";
  value: string;
  indicator?: string;
}

interface ExitCondition {
  id: string;
  type: "time" | "sl_pct" | "target_pct" | "sl_points" | "target_points" | "trailing_sl" | "mtm_loss" | "mtm_profit";
  value: string;
}

interface AlgoStrategy {
  id: string;
  name: string;
  instrument: string;
  legs: StrategyLeg[];
  entryConditions: EntryCondition[];
  exitConditions: ExitCondition[];
  status: "draft" | "backtested" | "deployed" | "paused";
  recurrence: "once" | "daily" | "weekly" | "monthly";
  telegramAlert: boolean;
  createdAt: Date;
  backtestResult?: BacktestSummary;
}

// ── Constants ──
const instruments = ["NIFTY", "BANKNIFTY", "SENSEX", "FINNIFTY", "MIDCPNIFTY", "BANKEX"];
const lotSizes: Record<string, number> = { NIFTY: 50, BANKNIFTY: 15, SENSEX: 10, FINNIFTY: 25, MIDCPNIFTY: 50, BANKEX: 10 };
const strikeOptions = ["ATM", "ATM+1", "ATM+2", "ATM+3", "ATM-1", "ATM-2", "ATM-3", "CUSTOM"];

const indicatorOptions = [
  "RSI (14)", "MACD (12,26,9)", "EMA (9)", "EMA (21)", "SMA (20)", "SMA (50)",
  "Bollinger Bands", "VWAP", "Supertrend", "ADX", "Stochastic RSI",
  "ATR (14)", "CCI (20)", "Williams %R", "Parabolic SAR", "Ichimoku",
];

const presetStrategies: Omit<AlgoStrategy, "id" | "createdAt" | "status" | "backtestResult">[] = [
  {
    name: "Short Straddle",
    instrument: "NIFTY",
    legs: [
      { id: "1", segment: "OPT", side: "SELL", optionType: "CE", strikeSelection: "ATM", lots: 1, expiry: "current" },
      { id: "2", segment: "OPT", side: "SELL", optionType: "PE", strikeSelection: "ATM", lots: 1, expiry: "current" },
    ],
    entryConditions: [{ id: "1", type: "time", operator: ">=", value: "09:20" }],
    exitConditions: [
      { id: "1", type: "sl_pct", value: "30" },
      { id: "2", type: "time", value: "15:15" },
    ],
    recurrence: "daily",
    telegramAlert: true,
  },
  {
    name: "Short Strangle",
    instrument: "NIFTY",
    legs: [
      { id: "1", segment: "OPT", side: "SELL", optionType: "CE", strikeSelection: "ATM+2", lots: 1, expiry: "current" },
      { id: "2", segment: "OPT", side: "SELL", optionType: "PE", strikeSelection: "ATM-2", lots: 1, expiry: "current" },
    ],
    entryConditions: [{ id: "1", type: "time", operator: ">=", value: "09:20" }],
    exitConditions: [
      { id: "1", type: "sl_pct", value: "50" },
      { id: "2", type: "time", value: "15:15" },
    ],
    recurrence: "daily",
    telegramAlert: true,
  },
  {
    name: "Iron Condor",
    instrument: "BANKNIFTY",
    legs: [
      { id: "1", segment: "OPT", side: "SELL", optionType: "CE", strikeSelection: "ATM+1", lots: 1, expiry: "current" },
      { id: "2", segment: "OPT", side: "BUY", optionType: "CE", strikeSelection: "ATM+3", lots: 1, expiry: "current" },
      { id: "3", segment: "OPT", side: "SELL", optionType: "PE", strikeSelection: "ATM-1", lots: 1, expiry: "current" },
      { id: "4", segment: "OPT", side: "BUY", optionType: "PE", strikeSelection: "ATM-3", lots: 1, expiry: "current" },
    ],
    entryConditions: [{ id: "1", type: "time", operator: ">=", value: "09:30" }],
    exitConditions: [
      { id: "1", type: "mtm_loss", value: "5000" },
      { id: "2", type: "mtm_profit", value: "3000" },
      { id: "3", type: "time", value: "15:20" },
    ],
    recurrence: "daily",
    telegramAlert: true,
  },
  {
    name: "Calendar Spread",
    instrument: "NIFTY",
    legs: [
      { id: "1", segment: "OPT", side: "SELL", optionType: "CE", strikeSelection: "ATM", lots: 1, expiry: "current" },
      { id: "2", segment: "OPT", side: "BUY", optionType: "CE", strikeSelection: "ATM", lots: 1, expiry: "next" },
    ],
    entryConditions: [{ id: "1", type: "time", operator: ">=", value: "09:30" }],
    exitConditions: [
      { id: "1", type: "target_pct", value: "50" },
      { id: "2", type: "sl_pct", value: "30" },
    ],
    recurrence: "weekly",
    telegramAlert: true,
  },
  {
    name: "Bull Put Spread",
    instrument: "NIFTY",
    legs: [
      { id: "1", segment: "OPT", side: "SELL", optionType: "PE", strikeSelection: "ATM-1", lots: 1, expiry: "current" },
      { id: "2", segment: "OPT", side: "BUY", optionType: "PE", strikeSelection: "ATM-3", lots: 1, expiry: "current" },
    ],
    entryConditions: [{ id: "1", type: "price_move", operator: ">", value: "0.3" }],
    exitConditions: [
      { id: "1", type: "target_pct", value: "60" },
      { id: "2", type: "sl_pct", value: "100" },
    ],
    recurrence: "daily",
    telegramAlert: false,
  },
  {
    name: "Expiry Day Straddle",
    instrument: "SENSEX",
    legs: [
      { id: "1", segment: "OPT", side: "SELL", optionType: "CE", strikeSelection: "ATM", lots: 1, expiry: "current" },
      { id: "2", segment: "OPT", side: "SELL", optionType: "PE", strikeSelection: "ATM", lots: 1, expiry: "current" },
    ],
    entryConditions: [{ id: "1", type: "time", operator: ">=", value: "09:20" }],
    exitConditions: [
      { id: "1", type: "sl_points", value: "150" },
      { id: "2", type: "time", value: "15:25" },
    ],
    recurrence: "weekly",
    telegramAlert: true,
  },
];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const Algo = () => {
  const { schedules, executions, loading, createSchedule, updateSchedule, deleteSchedule, refresh } = useScheduledTrades();
  const { isConnected } = useBroker();
  const { runBacktest } = useBacktesting();

  const [activeTab, setActiveTab] = useState("builder");
  const [strategies, setStrategies] = useState<AlgoStrategy[]>([]);
  const [editingStrategy, setEditingStrategy] = useState<AlgoStrategy | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [btRunning, setBtRunning] = useState(false);

  const niftyExpiries = useMemo(() => getUpcomingExpiries(true, 6), []);
  const daysToExpiry = niftyExpiries[0] ? getDaysToExpiry(niftyExpiries[0].date) : 0;

  // ── Strategy Builder Helpers ──
  const createNewStrategy = (): AlgoStrategy => ({
    id: generateId(),
    name: "My Strategy",
    instrument: "NIFTY",
    legs: [
      { id: generateId(), segment: "OPT", side: "SELL", optionType: "CE", strikeSelection: "ATM", lots: 1, expiry: "current" },
      { id: generateId(), segment: "OPT", side: "SELL", optionType: "PE", strikeSelection: "ATM", lots: 1, expiry: "current" },
    ],
    entryConditions: [{ id: generateId(), type: "time", operator: ">=", value: "09:20" }],
    exitConditions: [{ id: generateId(), type: "sl_pct", value: "30" }],
    status: "draft",
    recurrence: "daily",
    telegramAlert: true,
    createdAt: new Date(),
  });

  const loadPreset = (preset: typeof presetStrategies[0]) => {
    const strat: AlgoStrategy = {
      ...preset,
      id: generateId(),
      status: "draft",
      createdAt: new Date(),
      legs: preset.legs.map((l) => ({ ...l, id: generateId() })),
      entryConditions: preset.entryConditions.map((c) => ({ ...c, id: generateId() })),
      exitConditions: preset.exitConditions.map((c) => ({ ...c, id: generateId() })),
    };
    setEditingStrategy(strat);
    setShowPresets(false);
    setActiveTab("builder");
  };

  const addLeg = () => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      legs: [
        ...editingStrategy.legs,
        { id: generateId(), segment: "OPT", side: "BUY", optionType: "CE", strikeSelection: "ATM", lots: 1, expiry: "current" },
      ],
    });
  };

  const removeLeg = (legId: string) => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      legs: editingStrategy.legs.filter((l) => l.id !== legId),
    });
  };

  const updateLeg = (legId: string, updates: Partial<StrategyLeg>) => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      legs: editingStrategy.legs.map((l) => (l.id === legId ? { ...l, ...updates } : l)),
    });
  };

  const addEntryCondition = () => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      entryConditions: [
        ...editingStrategy.entryConditions,
        { id: generateId(), type: "indicator", operator: ">", value: "70", indicator: "RSI (14)" },
      ],
    });
  };

  const removeEntryCondition = (id: string) => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      entryConditions: editingStrategy.entryConditions.filter((c) => c.id !== id),
    });
  };

  const updateEntryCondition = (id: string, updates: Partial<EntryCondition>) => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      entryConditions: editingStrategy.entryConditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const addExitCondition = () => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      exitConditions: [
        ...editingStrategy.exitConditions,
        { id: generateId(), type: "target_pct", value: "50" },
      ],
    });
  };

  const removeExitCondition = (id: string) => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      exitConditions: editingStrategy.exitConditions.filter((c) => c.id !== id),
    });
  };

  const updateExitCondition = (id: string, updates: Partial<ExitCondition>) => {
    if (!editingStrategy) return;
    setEditingStrategy({
      ...editingStrategy,
      exitConditions: editingStrategy.exitConditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const saveStrategy = () => {
    if (!editingStrategy) return;
    setStrategies((prev) => {
      const idx = prev.findIndex((s) => s.id === editingStrategy.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = editingStrategy;
        return updated;
      }
      return [...prev, editingStrategy];
    });
    setEditingStrategy(null);
  };

  const handleBacktest = () => {
    if (!editingStrategy) return;
    setBtRunning(true);
    setTimeout(() => {
      const strategyMap: Record<string, string> = {
        "Short Straddle": "straddle",
        "Short Strangle": "strangle",
        "Iron Condor": "iron_condor",
        "Calendar Spread": "calendar_spread",
      };
      const stratType = strategyMap[editingStrategy.name] || "straddle";
      const result = runBacktest({
        instrument: editingStrategy.instrument,
        strategy: stratType,
        days: 90,
        quantity: (editingStrategy.legs[0]?.lots || 1) * (lotSizes[editingStrategy.instrument] || 50),
        stopLossPct: parseFloat(editingStrategy.exitConditions.find((c) => c.type === "sl_pct")?.value || "30"),
      });
      setEditingStrategy({ ...editingStrategy, backtestResult: result, status: "backtested" });
      setBtRunning(false);
    }, 1000);
  };

  const deployStrategy = (stratId: string) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === stratId ? { ...s, status: "deployed" as const } : s))
    );
  };

  const pauseStrategy = (stratId: string) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === stratId ? { ...s, status: s.status === "deployed" ? "paused" as const : "deployed" as const } : s))
    );
  };

  // ── Shared Components ──
  const SelectInput = ({ label, value, onChange, options, className }: {
    label?: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; className?: string;
  }) => (
    <div className={className}>
      {label && <label className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-muted text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    backtested: "bg-primary/10 text-primary",
    deployed: "bg-success/10 text-profit",
    paused: "bg-warning/10 text-warning",
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Algo Trading</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              No-code strategy builder • Backtest • Deploy • Monitor
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Timer className="w-3 h-3" />
              Expiry: {daysToExpiry}d
            </Badge>
            <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5 h-8">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingStrategy(createNewStrategy());
                setActiveTab("builder");
              }}
              className="gap-1.5 h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              New Strategy
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="builder" className="gap-1 text-xs">
              <Layers className="w-3.5 h-3.5" /> Builder
            </TabsTrigger>
            <TabsTrigger value="strategies" className="gap-1 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> My Strategies
            </TabsTrigger>
            <TabsTrigger value="presets" className="gap-1 text-xs">
              <Copy className="w-3.5 h-3.5" /> Templates
            </TabsTrigger>
            <TabsTrigger value="deployed" className="gap-1 text-xs">
              <Rocket className="w-3.5 h-3.5" /> Live
            </TabsTrigger>
          </TabsList>

          {/* ═══════════ BUILDER TAB ═══════════ */}
          <TabsContent value="builder" className="space-y-4 mt-4">
            {editingStrategy ? (
              <>
                {/* Strategy Header */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <label className="text-[9px] text-muted-foreground uppercase tracking-wider">Strategy Name</label>
                        <input
                          value={editingStrategy.name}
                          onChange={(e) => setEditingStrategy({ ...editingStrategy, name: e.target.value })}
                          className="w-full bg-muted text-foreground text-sm px-3 py-1.5 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-medium mt-1"
                        />
                      </div>
                      <SelectInput
                        label="Instrument"
                        value={editingStrategy.instrument}
                        onChange={(v) => setEditingStrategy({ ...editingStrategy, instrument: v })}
                        options={instruments.map((i) => ({ value: i, label: i }))}
                        className="w-32"
                      />
                      <SelectInput
                        label="Recurrence"
                        value={editingStrategy.recurrence}
                        onChange={(v) => setEditingStrategy({ ...editingStrategy, recurrence: v as any })}
                        options={[
                          { value: "once", label: "One-time" },
                          { value: "daily", label: "Daily" },
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                        ]}
                        className="w-28"
                      />
                      <div className="flex items-end gap-1.5 pt-3">
                        <button
                          onClick={() => setEditingStrategy({ ...editingStrategy, telegramAlert: !editingStrategy.telegramAlert })}
                          className={cn(
                            "p-1.5 rounded-md border transition-colors",
                            editingStrategy.telegramAlert ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
                          )}
                          title="Telegram Alerts"
                        >
                          {editingStrategy.telegramAlert ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Legs Builder */}
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        Strategy Legs
                        <Badge variant="secondary" className="text-[9px] ml-1">{editingStrategy.legs.length} legs</Badge>
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={addLeg} className="h-7 text-xs gap-1">
                        <PlusCircle className="w-3 h-3" /> Add Leg
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {/* Column Headers */}
                      <div className="grid grid-cols-[40px_70px_60px_55px_100px_65px_70px_32px] gap-2 text-[9px] text-muted-foreground uppercase tracking-wider px-1">
                        <span>Leg</span>
                        <span>Segment</span>
                        <span>B/S</span>
                        <span>Type</span>
                        <span>Strike</span>
                        <span>Lots</span>
                        <span>Expiry</span>
                        <span></span>
                      </div>

                      {editingStrategy.legs.map((leg, i) => (
                        <div
                          key={leg.id}
                          className={cn(
                            "grid grid-cols-[40px_70px_60px_55px_100px_65px_70px_32px] gap-2 items-center p-2 rounded-lg border transition-colors",
                            leg.side === "BUY" ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <GripVertical className="w-3 h-3 text-muted-foreground/40" />
                            <span className="text-xs font-mono text-muted-foreground">L{i + 1}</span>
                          </div>

                          <select
                            value={leg.segment}
                            onChange={(e) => updateLeg(leg.id, { segment: e.target.value as any })}
                            className="bg-muted text-foreground text-[11px] px-1.5 py-1 rounded border border-border/50"
                          >
                            <option value="OPT">Options</option>
                            <option value="FUT">Futures</option>
                          </select>

                          <button
                            onClick={() => updateLeg(leg.id, { side: leg.side === "BUY" ? "SELL" : "BUY" })}
                            className={cn(
                              "text-[11px] font-bold py-1 rounded border text-center",
                              leg.side === "BUY"
                                ? "bg-success/20 text-profit border-success/30"
                                : "bg-destructive/20 text-loss border-destructive/30"
                            )}
                          >
                            {leg.side}
                          </button>

                          {leg.segment === "OPT" ? (
                            <select
                              value={leg.optionType}
                              onChange={(e) => updateLeg(leg.id, { optionType: e.target.value as any })}
                              className="bg-muted text-foreground text-[11px] px-1.5 py-1 rounded border border-border/50"
                            >
                              <option value="CE">CE</option>
                              <option value="PE">PE</option>
                            </select>
                          ) : (
                            <span className="text-[11px] text-muted-foreground text-center">FUT</span>
                          )}

                          <select
                            value={leg.strikeSelection}
                            onChange={(e) => updateLeg(leg.id, { strikeSelection: e.target.value as any })}
                            className="bg-muted text-foreground text-[11px] px-1.5 py-1 rounded border border-border/50"
                          >
                            {strikeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>

                          <input
                            type="number"
                            value={leg.lots}
                            onChange={(e) => updateLeg(leg.id, { lots: Math.max(1, Number(e.target.value)) })}
                            min={1}
                            className="bg-muted text-foreground text-[11px] px-1.5 py-1 rounded border border-border/50 font-mono w-full"
                          />

                          <select
                            value={leg.expiry}
                            onChange={(e) => updateLeg(leg.id, { expiry: e.target.value as any })}
                            className="bg-muted text-foreground text-[11px] px-1.5 py-1 rounded border border-border/50"
                          >
                            <option value="current">Current</option>
                            <option value="next">Next</option>
                            <option value="far">Far</option>
                          </select>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-6 h-6"
                            onClick={() => removeLeg(leg.id)}
                            disabled={editingStrategy.legs.length <= 1}
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Lot Size Info */}
                    <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
                      <span>Lot size: <span className="font-mono text-foreground">{lotSizes[editingStrategy.instrument] || 50}</span></span>
                      <span>Total qty: <span className="font-mono text-foreground">
                        {editingStrategy.legs.reduce((s, l) => s + l.lots, 0) * (lotSizes[editingStrategy.instrument] || 50)}
                      </span></span>
                    </div>
                  </CardContent>
                </Card>

                {/* Entry Conditions */}
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-profit" />
                        Entry Conditions
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={addEntryCondition} className="h-7 text-xs gap-1">
                        <PlusCircle className="w-3 h-3" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {editingStrategy.entryConditions.map((cond, i) => (
                      <div key={cond.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/20">
                        {i > 0 && <Badge variant="secondary" className="text-[8px] shrink-0">AND</Badge>}

                        <SelectInput
                          value={cond.type}
                          onChange={(v) => updateEntryCondition(cond.id, { type: v as any })}
                          options={[
                            { value: "time", label: "Time" },
                            { value: "premium", label: "Premium ₹" },
                            { value: "indicator", label: "Indicator" },
                            { value: "price_move", label: "Price Move %" },
                            { value: "iv", label: "India VIX" },
                            { value: "oi_change", label: "OI Change" },
                          ]}
                          className="w-28"
                        />

                        {cond.type === "indicator" && (
                          <SelectInput
                            value={cond.indicator || "RSI (14)"}
                            onChange={(v) => updateEntryCondition(cond.id, { indicator: v })}
                            options={indicatorOptions.map((i) => ({ value: i, label: i }))}
                            className="w-36"
                          />
                        )}

                        <SelectInput
                          value={cond.operator}
                          onChange={(v) => updateEntryCondition(cond.id, { operator: v as any })}
                          options={[
                            { value: ">", label: ">" },
                            { value: "<", label: "<" },
                            { value: ">=", label: ">=" },
                            { value: "<=", label: "<=" },
                            { value: "=", label: "=" },
                          ]}
                          className="w-16"
                        />

                        <input
                          type={cond.type === "time" ? "time" : "text"}
                          value={cond.value}
                          onChange={(e) => updateEntryCondition(cond.id, { value: e.target.value })}
                          className="w-24 bg-muted text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border/50 font-mono"
                        />

                        <Button size="icon" variant="ghost" className="w-6 h-6 shrink-0" onClick={() => removeEntryCondition(cond.id)}>
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Exit Conditions */}
                <Card>
                  <CardHeader className="pb-2 px-4 pt-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-loss" />
                        Exit / Risk Management
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={addExitCondition} className="h-7 text-xs gap-1">
                        <PlusCircle className="w-3 h-3" /> Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {editingStrategy.exitConditions.map((cond, i) => (
                      <div key={cond.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-secondary/20">
                        {i > 0 && <Badge variant="secondary" className="text-[8px] shrink-0">OR</Badge>}

                        <SelectInput
                          value={cond.type}
                          onChange={(v) => updateExitCondition(cond.id, { type: v as any })}
                          options={[
                            { value: "sl_pct", label: "SL % (per leg)" },
                            { value: "target_pct", label: "Target %" },
                            { value: "sl_points", label: "SL Points" },
                            { value: "target_points", label: "Target Points" },
                            { value: "trailing_sl", label: "Trailing SL %" },
                            { value: "mtm_loss", label: "MTM Loss ₹" },
                            { value: "mtm_profit", label: "MTM Profit ₹" },
                            { value: "time", label: "Exit Time" },
                          ]}
                          className="w-32"
                        />

                        <input
                          type={cond.type === "time" ? "time" : "text"}
                          value={cond.value}
                          onChange={(e) => updateExitCondition(cond.id, { value: e.target.value })}
                          className="w-24 bg-muted text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border/50 font-mono"
                        />

                        <Button size="icon" variant="ghost" className="w-6 h-6 shrink-0" onClick={() => removeExitCondition(cond.id)}>
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={handleBacktest} disabled={btRunning} variant="outline" className="gap-1.5">
                    {btRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
                    {btRunning ? "Running Backtest..." : "Backtest"}
                  </Button>
                  <Button onClick={saveStrategy} className="gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Save Strategy
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingStrategy(null)} className="gap-1.5">
                    <X className="w-4 h-4" /> Cancel
                  </Button>
                </div>

                {/* Backtest Results */}
                {editingStrategy.backtestResult && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        Backtest Results — {editingStrategy.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: "Total P&L", value: `${editingStrategy.backtestResult.totalPnl >= 0 ? "+" : ""}₹${editingStrategy.backtestResult.totalPnl.toLocaleString("en-IN")}`, color: editingStrategy.backtestResult.totalPnl >= 0 ? "text-profit" : "text-loss" },
                          { label: "Win Rate", value: `${editingStrategy.backtestResult.winRate}%`, color: editingStrategy.backtestResult.winRate >= 50 ? "text-profit" : "text-loss" },
                          { label: "Sharpe", value: editingStrategy.backtestResult.sharpeRatio.toFixed(2), color: "text-primary" },
                          { label: "Max DD", value: `₹${editingStrategy.backtestResult.maxDrawdown.toLocaleString("en-IN")}`, color: "text-loss" },
                        ].map((s) => (
                          <div key={s.label} className="p-3 rounded-lg border border-border bg-secondary/20">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                            <p className={cn("text-lg font-bold font-mono", s.color)}>{s.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={editingStrategy.backtestResult.results}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="cumulativePnl" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <Button
                        onClick={() => {
                          saveStrategy();
                          if (editingStrategy) deployStrategy(editingStrategy.id);
                        }}
                        className="gap-1.5"
                      >
                        <Rocket className="w-4 h-4" /> Deploy Live
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground/20 mb-4" />
                <h3 className="text-sm font-semibold text-foreground mb-1">No strategy selected</h3>
                <p className="text-xs text-muted-foreground mb-4">Create a new strategy or load a template to get started.</p>
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={() => setEditingStrategy(createNewStrategy())} className="gap-1.5">
                    <Plus className="w-4 h-4" /> New Strategy
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("presets")} className="gap-1.5">
                    <Copy className="w-4 h-4" /> Load Template
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════════ MY STRATEGIES TAB ═══════════ */}
          <TabsContent value="strategies" className="space-y-4 mt-4">
            {strategies.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-xs text-muted-foreground">No strategies saved yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {strategies.map((strat) => (
                  <Card key={strat.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{strat.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px]">{strat.instrument}</Badge>
                            <Badge className={cn("text-[9px]", statusColors[strat.status])}>{strat.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">{strat.legs.length} legs</span>
                          </div>
                        </div>
                      </div>

                      {/* Legs Summary */}
                      <div className="space-y-1 mb-3">
                        {strat.legs.map((l, i) => (
                          <div key={l.id} className="flex items-center gap-2 text-[10px]">
                            <span className={cn("font-bold", l.side === "BUY" ? "text-profit" : "text-loss")}>{l.side}</span>
                            <span className="text-foreground">{l.lots}L</span>
                            <span className="text-muted-foreground">{l.strikeSelection} {l.optionType}</span>
                            <span className="text-muted-foreground capitalize">{l.expiry}</span>
                          </div>
                        ))}
                      </div>

                      {/* Backtest Summary */}
                      {strat.backtestResult && (
                        <div className="flex items-center gap-3 text-[10px] mb-3 p-2 rounded bg-secondary/30 border border-border/50">
                          <span className={cn("font-mono font-bold", strat.backtestResult.totalPnl >= 0 ? "text-profit" : "text-loss")}>
                            P&L: {strat.backtestResult.totalPnl >= 0 ? "+" : ""}₹{strat.backtestResult.totalPnl.toLocaleString("en-IN")}
                          </span>
                          <span className="text-muted-foreground">WR: {strat.backtestResult.winRate}%</span>
                          <span className="text-muted-foreground">DD: ₹{strat.backtestResult.maxDrawdown.toLocaleString("en-IN")}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1"
                          onClick={() => {
                            setEditingStrategy(strat);
                            setActiveTab("builder");
                          }}
                        >
                          <Settings2 className="w-3 h-3" /> Edit
                        </Button>
                        {strat.status === "backtested" && (
                          <Button size="sm" className="text-xs h-7 gap-1" onClick={() => deployStrategy(strat.id)}>
                            <Rocket className="w-3 h-3" /> Deploy
                          </Button>
                        )}
                        {(strat.status === "deployed" || strat.status === "paused") && (
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => pauseStrategy(strat.id)}>
                            {strat.status === "deployed" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            {strat.status === "deployed" ? "Pause" : "Resume"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => setStrategies((p) => p.filter((s) => s.id !== strat.id))}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ═══════════ TEMPLATES TAB ═══════════ */}
          <TabsContent value="presets" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {presetStrategies.map((preset, i) => (
                <Card key={i} className="hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => loadPreset(preset)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{preset.name}</h3>
                      <Badge variant="outline" className="text-[9px]">{preset.instrument}</Badge>
                    </div>

                    <div className="space-y-1 mb-3">
                      {preset.legs.map((l, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[10px]">
                          <span className={cn("font-bold w-8", l.side === "BUY" ? "text-profit" : "text-loss")}>{l.side}</span>
                          <span className="text-muted-foreground">{l.strikeSelection} {l.optionType}</span>
                          <span className="text-muted-foreground capitalize ml-auto">{l.expiry}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>{preset.entryConditions.length} entry rules</span>
                      <span>•</span>
                      <span>{preset.exitConditions.length} exit rules</span>
                      <span>•</span>
                      <span className="capitalize">{preset.recurrence}</span>
                    </div>

                    <Button size="sm" variant="outline" className="w-full mt-3 h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-3 h-3" /> Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ═══════════ LIVE/DEPLOYED TAB ═══════════ */}
          <TabsContent value="deployed" className="space-y-4 mt-4">
            {strategies.filter((s) => s.status === "deployed" || s.status === "paused").length === 0 ? (
              <div className="text-center py-16">
                <Rocket className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-xs text-muted-foreground">No strategies deployed. Build & backtest a strategy first.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {strategies
                  .filter((s) => s.status === "deployed" || s.status === "paused")
                  .map((strat) => (
                    <Card key={strat.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center",
                              strat.status === "deployed" ? "bg-success/10" : "bg-warning/10"
                            )}>
                              <Bot className={cn("w-5 h-5", strat.status === "deployed" ? "text-profit" : "text-warning")} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground">{strat.name}</h3>
                                <Badge variant="outline" className="text-[9px]">{strat.instrument}</Badge>
                                <div className={cn("w-2 h-2 rounded-full", strat.status === "deployed" ? "bg-profit animate-pulse" : "bg-warning")} />
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                                <span>{strat.legs.length} legs</span>
                                <span>•</span>
                                <span className="capitalize">{strat.recurrence}</span>
                                <span>•</span>
                                <span>{strat.entryConditions.length} entry / {strat.exitConditions.length} exit rules</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {strat.backtestResult && (
                              <span className={cn("text-sm font-mono font-bold mr-2", strat.backtestResult.totalPnl >= 0 ? "text-profit" : "text-loss")}>
                                {strat.backtestResult.totalPnl >= 0 ? "+" : ""}₹{strat.backtestResult.totalPnl.toLocaleString("en-IN")}
                              </span>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => pauseStrategy(strat.id)}>
                              {strat.status === "deployed" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              {strat.status === "deployed" ? "Pause" : "Resume"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}

            {/* Scheduled trades from DB */}
            {schedules.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Scheduled Trades (Legacy)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {schedules.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-secondary/20">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <div>
                          <span className="text-xs font-medium text-foreground">{s.instrument} {s.strategy_type}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{s.schedule_time.slice(0, 5)} IST</span>
                        </div>
                        <Badge variant={s.is_active ? "default" : "secondary"} className="text-[8px]">
                          {s.is_active ? "ACTIVE" : "PAUSED"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => updateSchedule(s.id, { is_active: !s.is_active })}>
                          {s.is_active ? <Pause className="w-3 h-3 text-warning" /> : <Play className="w-3 h-3 text-profit" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => deleteSchedule(s.id)}>
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Algo;
