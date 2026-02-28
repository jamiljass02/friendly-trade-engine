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
  Shield,
  Trash2,
  Bell,
  BellOff,
  Target,
  TrendingDown,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduledTrades } from "@/hooks/useScheduledTrades";
import { useBroker } from "@/hooks/useBroker";
import { getUpcomingExpiries, getDaysToExpiry } from "@/lib/expiry-utils";

type RecurrenceType = "once" | "daily" | "weekly" | "monthly";
type AlgoCategory = "schedule" | "recurring" | "rollover" | "expiry";

const lotSize: Record<string, number> = {
  NIFTY: 50, BANKNIFTY: 15, SENSEX: 10,
  RELIANCE: 250, TCS: 150, HDFCBANK: 550, INFY: 300, ICICIBANK: 700,
};

const instruments = [
  "NIFTY", "BANKNIFTY", "SENSEX",
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "BHARTIARTL",
];

const weeklyEligible = ["NIFTY", "SENSEX"];

const Algo = () => {
  const {
    schedules,
    executions,
    loading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    refresh,
  } = useScheduledTrades();
  const { isConnected } = useBroker();

  const [activeTab, setActiveTab] = useState<AlgoCategory>("schedule");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Schedule Form State ──
  const [form, setForm] = useState({
    instrument: "NIFTY",
    strategy_type: "straddle",
    selection_mode: "atm",
    premium_target: 100,
    otm_percent: 2,
    quantity: 50,
    stop_loss_percent: 50,
    schedule_time: "09:20",
    telegram_alert: true,
    recurrence: "daily" as RecurrenceType,
  });

  // ── Rollover Config ──
  const [rolloverConfig, setRolloverConfig] = useState({
    instrument: "NIFTY",
    daysBeforeExpiry: 2,
    autoRollover: true,
    targetExpiry: "next" as "next" | "far",
    maxBasisCost: 0.5,
  });

  // ── Expiry Day Config ──
  const [expiryConfig, setExpiryConfig] = useState({
    instrument: "NIFTY",
    squareOffTime: "15:00",
    autoSquareOff: true,
    shiftToNextExpiry: true,
    maxLossToHold: 5000,
  });

  // ── Computed Data ──
  const niftyExpiries = useMemo(() => getUpcomingExpiries(true, 6), []);
  const currentExpiry = niftyExpiries[0];
  const daysToCurrentExpiry = currentExpiry ? getDaysToExpiry(currentExpiry.date) : 0;

  const stats = useMemo(() => {
    const active = schedules.filter((s) => s.is_active).length;
    const todayExecs = executions.filter(
      (e) => new Date(e.executed_at).toDateString() === new Date().toDateString()
    );
    const totalPremium = todayExecs.reduce((s, e) => s + (e.total_premium || 0), 0);
    const successRate =
      todayExecs.length > 0
        ? Math.round(
            (todayExecs.filter((e) => e.status === "executed").length / todayExecs.length) * 100
          )
        : 0;
    return { active, todayTrades: todayExecs.length, totalPremium, successRate };
  }, [schedules, executions]);

  const handleCreate = async () => {
    setSaving(true);
    await createSchedule({
      instrument: form.instrument,
      strategy_type: form.strategy_type,
      selection_mode: form.selection_mode,
      premium_target: form.selection_mode === "premium_target" ? form.premium_target : null,
      otm_percent: form.selection_mode === "otm_percent" ? form.otm_percent : null,
      quantity: form.quantity,
      stop_loss_percent: form.stop_loss_percent,
      schedule_time: form.schedule_time + ":00",
      is_active: true,
      telegram_alert: form.telegram_alert,
    });
    setSaving(false);
    setShowForm(false);
  };

  // ── Shared Select Component ──
  const SelectField = ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }) => (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const NumberField = ({
    label,
    value,
    onChange,
    step,
    suffix,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    step?: number;
    suffix?: string;
  }) => (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="relative mt-1">
        <input
          type="number"
          step={step || 1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Algo Trading</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated execution • Scheduling • Rollover • Expiry management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Algo
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Algos", value: String(stats.active), icon: Bot, color: "text-primary" },
            {
              label: "Today's Premium",
              value: `₹${stats.totalPremium.toLocaleString("en-IN")}`,
              icon: TrendingUp,
              color: "text-profit",
            },
            { label: "Trades Today", value: String(stats.todayTrades), icon: Clock, color: "text-muted-foreground" },
            {
              label: "Expiry In",
              value: `${daysToCurrentExpiry}d`,
              icon: Timer,
              color: daysToCurrentExpiry <= 1 ? "text-loss" : "text-primary",
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                  <s.icon className={cn("w-4 h-4", s.color)} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-lg font-bold font-mono text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AlgoCategory)}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="schedule" className="gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5" /> Schedules
            </TabsTrigger>
            <TabsTrigger value="recurring" className="gap-1.5 text-xs">
              <Repeat className="w-3.5 h-3.5" /> Recurring
            </TabsTrigger>
            <TabsTrigger value="rollover" className="gap-1.5 text-xs">
              <ArrowRightLeft className="w-3.5 h-3.5" /> Rollover
            </TabsTrigger>
            <TabsTrigger value="expiry" className="gap-1.5 text-xs">
              <CalendarDays className="w-3.5 h-3.5" /> Expiry Day
            </TabsTrigger>
          </TabsList>

          {/* ═══════════ SCHEDULES TAB ═══════════ */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            {/* Create Form */}
            {showForm && (
              <Card className="animate-slide-up">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    New Scheduled Trade
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SelectField
                      label="Instrument"
                      value={form.instrument}
                      onChange={(v) =>
                        setForm({ ...form, instrument: v, quantity: lotSize[v] || 50 })
                      }
                      options={instruments.map((i) => ({ value: i, label: i }))}
                    />
                    <SelectField
                      label="Strategy"
                      value={form.strategy_type}
                      onChange={(v) => setForm({ ...form, strategy_type: v })}
                      options={[
                        { value: "straddle", label: "Short Straddle" },
                        { value: "strangle", label: "Short Strangle" },
                        { value: "iron_condor", label: "Iron Condor" },
                        { value: "calendar_spread", label: "Calendar Spread" },
                      ]}
                    />
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Execute At
                      </label>
                      <input
                        type="time"
                        value={form.schedule_time}
                        onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
                        className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>
                    <NumberField
                      label={`Lots (${form.quantity} qty)`}
                      value={form.quantity}
                      onChange={(v) => setForm({ ...form, quantity: v })}
                    />
                  </div>

                  {/* Strike Selection */}
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">
                      Strike Selection
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { mode: "atm", icon: Target, title: "ATM", desc: "At-the-money" },
                        {
                          mode: "premium_target",
                          icon: TrendingDown,
                          title: "Premium",
                          desc: "₹/lot target",
                        },
                        { mode: "otm_percent", icon: Percent, title: "OTM %", desc: "% from ATM" },
                      ].map((opt) => (
                        <button
                          key={opt.mode}
                          onClick={() => setForm({ ...form, selection_mode: opt.mode })}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                            form.selection_mode === opt.mode
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <opt.icon
                            className={cn(
                              "w-4 h-4",
                              form.selection_mode === opt.mode
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          />
                          <div>
                            <p className="text-xs font-medium text-foreground">{opt.title}</p>
                            <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {form.selection_mode === "premium_target" && (
                      <NumberField
                        label="Target Premium (₹/lot)"
                        value={form.premium_target}
                        onChange={(v) => setForm({ ...form, premium_target: v })}
                      />
                    )}
                    {form.selection_mode === "otm_percent" && (
                      <NumberField
                        label="OTM Distance (%)"
                        value={form.otm_percent}
                        onChange={(v) => setForm({ ...form, otm_percent: v })}
                        step={0.5}
                      />
                    )}
                    <NumberField
                      label="Stop Loss (% of premium)"
                      value={form.stop_loss_percent}
                      onChange={(v) => setForm({ ...form, stop_loss_percent: v })}
                    />
                    <SelectField
                      label="Recurrence"
                      value={form.recurrence}
                      onChange={(v) => setForm({ ...form, recurrence: v as RecurrenceType })}
                      options={[
                        { value: "once", label: "One-time" },
                        { value: "daily", label: "Daily" },
                        { value: "weekly", label: "Weekly (Thu)" },
                        { value: "monthly", label: "Monthly Expiry" },
                      ]}
                    />
                    <div className="flex items-end">
                      <button
                        onClick={() =>
                          setForm({ ...form, telegram_alert: !form.telegram_alert })
                        }
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md border transition-colors w-full h-[34px]",
                          form.telegram_alert
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {form.telegram_alert ? (
                          <Bell className="w-4 h-4" />
                        ) : (
                          <BellOff className="w-4 h-4" />
                        )}
                        <span className="text-xs font-medium">
                          {form.telegram_alert ? "Alerts ON" : "Alerts OFF"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleCreate} disabled={saving} size="sm" className="gap-1.5">
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {saving ? "Saving..." : "Create Schedule"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Schedules List */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Active Schedules
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {schedules.length} configured
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-8">
                    <Bot className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No scheduled trades. Create one above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-card flex items-center justify-center border border-border">
                            <Clock className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {s.instrument}{" "}
                                {s.strategy_type === "straddle" ? "Straddle" : "Strangle"}
                              </span>
                              <Badge
                                variant={s.is_active ? "default" : "secondary"}
                                className="text-[9px] px-1.5 py-0"
                              >
                                {s.is_active ? "ACTIVE" : "PAUSED"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
                              <span>{s.schedule_time.slice(0, 5)} IST</span>
                              <span>•</span>
                              <span>
                                {s.selection_mode === "atm"
                                  ? "ATM"
                                  : s.selection_mode === "premium_target"
                                  ? `₹${s.premium_target}/lot`
                                  : `${s.otm_percent}% OTM`}
                              </span>
                              <span>•</span>
                              <span>SL {s.stop_loss_percent}%</span>
                              <span>•</span>
                              <span>Qty {s.quantity}</span>
                              {s.telegram_alert && (
                                <>
                                  <span>•</span>
                                  <Bell className="w-2.5 h-2.5 text-primary" />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7"
                            onClick={() =>
                              updateSchedule(s.id, { is_active: !s.is_active })
                            }
                          >
                            {s.is_active ? (
                              <Pause className="w-3.5 h-3.5 text-warning" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-profit" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7"
                            onClick={() => deleteSchedule(s.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Executions */}
            {executions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-profit" />
                    Recent Executions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50">
                          {["Time", "Instrument", "Strategy", "Premium", "SL", "Status"].map(
                            (h) => (
                              <th
                                key={h}
                                className="text-left px-3 py-2 text-muted-foreground font-medium uppercase tracking-wider text-[10px]"
                              >
                                {h}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {executions.slice(0, 10).map((ex) => (
                          <tr key={ex.id} className="data-row">
                            <td className="px-3 py-2 font-mono text-muted-foreground">
                              {new Date(ex.executed_at).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-3 py-2 font-mono text-foreground">
                              {ex.instrument}
                            </td>
                            <td className="px-3 py-2 text-foreground capitalize">
                              {ex.strategy_type}
                            </td>
                            <td className="px-3 py-2 font-mono text-profit">
                              {ex.total_premium
                                ? `₹${ex.total_premium.toLocaleString("en-IN")}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-loss">
                              {ex.stop_loss_price
                                ? `₹${ex.stop_loss_price.toLocaleString("en-IN")}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  ex.status === "executed"
                                    ? "default"
                                    : ex.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[9px]"
                              >
                                {ex.status.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════ RECURRING STRATEGIES TAB ═══════════ */}
          <TabsContent value="recurring" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-primary" />
                  Recurring Strategies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Configure strategies that auto-execute on a schedule — weekly on expiry days or
                  monthly.
                </p>

                {/* Preset strategies */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    {
                      name: "Weekly Straddle Seller",
                      desc: "Sell ATM straddle every Thursday at 9:20 AM. Auto-adjusts to current week expiry.",
                      frequency: "Weekly",
                      instrument: "NIFTY",
                      risk: "Medium",
                    },
                    {
                      name: "Monthly Iron Condor",
                      desc: "Deploy iron condor 15 days before monthly expiry. Auto-manages legs on expiry week.",
                      frequency: "Monthly",
                      instrument: "BANKNIFTY",
                      risk: "Low",
                    },
                    {
                      name: "Weekly Strangle",
                      desc: "Sell 2% OTM strangle on Wednesday, exit on Thursday. Premium decay strategy.",
                      frequency: "Weekly",
                      instrument: "NIFTY",
                      risk: "High",
                    },
                    {
                      name: "Expiry Day Scalper",
                      desc: "ATM straddle on expiry morning, exit at 50% profit or 2:30 PM whichever first.",
                      frequency: "Weekly",
                      instrument: "SENSEX",
                      risk: "High",
                    },
                  ].map((preset) => (
                    <div
                      key={preset.name}
                      className="p-4 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{preset.name}</h4>
                          <p className="text-[11px] text-muted-foreground mt-1">{preset.desc}</p>
                        </div>
                        <Badge
                          variant={
                            preset.risk === "Low"
                              ? "default"
                              : preset.risk === "Medium"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-[9px] shrink-0"
                        >
                          {preset.risk}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {preset.instrument}
                        </span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-primary font-medium">
                          {preset.frequency}
                        </span>
                        <div className="flex-1" />
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                          <Play className="w-3 h-3" />
                          Deploy
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Expiry Calendar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Upcoming Expiries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {niftyExpiries.map((exp) => (
                    <div
                      key={exp.fullLabel}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-colors",
                        exp.isCurrent
                          ? "border-primary bg-primary/5"
                          : exp.isNext
                          ? "border-accent/50 bg-accent/5"
                          : "border-border bg-secondary/20"
                      )}
                    >
                      <p className="text-xs font-mono font-semibold text-foreground">
                        {exp.label}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {getDaysToExpiry(exp.date)}d left
                      </p>
                      <Badge
                        variant={exp.isMonthly ? "default" : "secondary"}
                        className="text-[8px] mt-1"
                      >
                        {exp.isMonthly ? "Monthly" : "Weekly"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ ROLLOVER TAB ═══════════ */}
          <TabsContent value="rollover" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-primary" />
                  Calendar Spread Rollover
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Automatically roll positions from current to next expiry before contract expiration.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <SelectField
                    label="Instrument"
                    value={rolloverConfig.instrument}
                    onChange={(v) => setRolloverConfig({ ...rolloverConfig, instrument: v })}
                    options={instruments.map((i) => ({ value: i, label: i }))}
                  />
                  <NumberField
                    label="Roll Before Expiry"
                    value={rolloverConfig.daysBeforeExpiry}
                    onChange={(v) =>
                      setRolloverConfig({ ...rolloverConfig, daysBeforeExpiry: v })
                    }
                    suffix="days"
                  />
                  <SelectField
                    label="Target Expiry"
                    value={rolloverConfig.targetExpiry}
                    onChange={(v) =>
                      setRolloverConfig({
                        ...rolloverConfig,
                        targetExpiry: v as "next" | "far",
                      })
                    }
                    options={[
                      { value: "next", label: "Next Expiry" },
                      { value: "far", label: "Far Expiry" },
                    ]}
                  />
                  <NumberField
                    label="Max Basis Cost"
                    value={rolloverConfig.maxBasisCost}
                    onChange={(v) => setRolloverConfig({ ...rolloverConfig, maxBasisCost: v })}
                    step={0.1}
                    suffix="%"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/20">
                  <input
                    type="checkbox"
                    checked={rolloverConfig.autoRollover}
                    onChange={(e) =>
                      setRolloverConfig({ ...rolloverConfig, autoRollover: e.target.checked })
                    }
                    className="rounded border-border"
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground">Auto-Rollover</p>
                    <p className="text-[10px] text-muted-foreground">
                      Automatically close current expiry and open next expiry positions
                    </p>
                  </div>
                </div>

                {/* Rollover Preview */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-secondary/30 border-b border-border">
                    <h4 className="text-xs font-semibold text-foreground">Rollover Preview</h4>
                  </div>
                  <div className="p-4 space-y-3">
                    {niftyExpiries.slice(0, 3).map((exp, i) => (
                      <div
                        key={exp.fullLabel}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full",
                              i === 0 ? "bg-primary" : i === 1 ? "bg-accent" : "bg-muted-foreground"
                            )}
                          />
                          <span className="text-foreground font-mono">{exp.fullLabel}</span>
                          <Badge variant="secondary" className="text-[8px]">
                            {i === 0 ? "Current" : i === 1 ? "Next" : "Far"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{getDaysToExpiry(exp.date)}d</span>
                          {i === 0 && getDaysToExpiry(exp.date) <= rolloverConfig.daysBeforeExpiry && (
                            <Badge variant="destructive" className="text-[8px] gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Roll Now
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button size="sm" className="gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Save Rollover Config
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════ EXPIRY DAY TAB ═══════════ */}
          <TabsContent value="expiry" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Expiry Day Automation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Auto-adjustments on expiry day: square off positions, shift to next expiry, and manage risk.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <SelectField
                    label="Instrument"
                    value={expiryConfig.instrument}
                    onChange={(v) => setExpiryConfig({ ...expiryConfig, instrument: v })}
                    options={instruments.map((i) => ({ value: i, label: i }))}
                  />
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Square Off Time
                    </label>
                    <input
                      type="time"
                      value={expiryConfig.squareOffTime}
                      onChange={(e) =>
                        setExpiryConfig({ ...expiryConfig, squareOffTime: e.target.value })
                      }
                      className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                  <NumberField
                    label="Max Loss to Hold"
                    value={expiryConfig.maxLossToHold}
                    onChange={(v) => setExpiryConfig({ ...expiryConfig, maxLossToHold: v })}
                    suffix="₹"
                  />
                </div>

                <div className="space-y-2">
                  {[
                    {
                      key: "autoSquareOff",
                      label: "Auto Square-Off",
                      desc: "Automatically close all expiring positions at the configured time",
                      checked: expiryConfig.autoSquareOff,
                    },
                    {
                      key: "shiftToNextExpiry",
                      label: "Shift to Next Expiry",
                      desc: "After squaring off, re-deploy the same strategy on the next expiry",
                      checked: expiryConfig.shiftToNextExpiry,
                    },
                  ].map((opt) => (
                    <div
                      key={opt.key}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/20"
                    >
                      <input
                        type="checkbox"
                        checked={opt.checked}
                        onChange={(e) =>
                          setExpiryConfig({ ...expiryConfig, [opt.key]: e.target.checked })
                        }
                        className="rounded border-border"
                      />
                      <div>
                        <p className="text-xs font-medium text-foreground">{opt.label}</p>
                        <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Expiry Day Timeline */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-secondary/30 border-b border-border">
                    <h4 className="text-xs font-semibold text-foreground">
                      Expiry Day Timeline
                      {currentExpiry && (
                        <span className="text-muted-foreground font-normal ml-2">
                          Next: {currentExpiry.fullLabel}
                        </span>
                      )}
                    </h4>
                  </div>
                  <div className="p-4">
                    <div className="relative pl-6 space-y-4">
                      <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
                      {[
                        {
                          time: "09:15",
                          action: "Market Opens",
                          desc: "Monitor opening volatility",
                          icon: Play,
                          color: "text-primary",
                        },
                        {
                          time: "09:20",
                          action: "Deploy Strategy",
                          desc: "Execute scheduled algo if configured",
                          icon: Bot,
                          color: "text-primary",
                        },
                        {
                          time: "12:00",
                          action: "Mid-Day Check",
                          desc: "Review P&L, adjust SL if needed",
                          icon: Shield,
                          color: "text-warning",
                        },
                        {
                          time: expiryConfig.squareOffTime,
                          action: "Square Off",
                          desc: "Close all expiring positions",
                          icon: AlertTriangle,
                          color: "text-loss",
                        },
                        {
                          time: "15:20",
                          action: "Shift Expiry",
                          desc: "Re-deploy on next expiry if enabled",
                          icon: ArrowRightLeft,
                          color: "text-profit",
                        },
                        {
                          time: "15:30",
                          action: "Market Close",
                          desc: "Final reconciliation & alerts",
                          icon: CheckCircle2,
                          color: "text-muted-foreground",
                        },
                      ].map((step, i) => (
                        <div key={i} className="relative flex items-start gap-3">
                          <div
                            className={cn(
                              "absolute -left-[17px] w-3 h-3 rounded-full border-2 bg-card",
                              `border-current`,
                              step.color
                            )}
                          />
                          <span className="text-[10px] font-mono text-muted-foreground w-10 shrink-0 pt-0.5">
                            {step.time}
                          </span>
                          <div>
                            <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <step.icon className={cn("w-3 h-3", step.color)} />
                              {step.action}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Button size="sm" className="gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" />
                  Save Expiry Config
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Algo;
