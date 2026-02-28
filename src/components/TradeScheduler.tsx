import { useState } from "react";
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Pause,
  Bell,
  BellOff,
  Target,
  TrendingDown,
  Percent,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduledTrades, ScheduledTrade } from "@/hooks/useScheduledTrades";
import { useBroker } from "@/hooks/useBroker";

const TradeScheduler = () => {
  const { schedules, executions, loading, createSchedule, updateSchedule, deleteSchedule } =
    useScheduledTrades();
  const { isConnected } = useBroker();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    instrument: "NIFTY",
    strategy_type: "straddle",
    selection_mode: "atm",
    premium_target: 100,
    otm_percent: 2,
    quantity: 50,
    stop_loss_percent: 50,
    schedule_time: "09:15",
    telegram_alert: true,
  });
  const [saving, setSaving] = useState(false);

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

  const lotSize: Record<string, number> = { NIFTY: 50, BANKNIFTY: 15, SENSEX: 10 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Trade Scheduler</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automate straddle/strangle execution at scheduled times
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors glow-primary"
        >
          <Plus className="w-3.5 h-3.5" />
          New Schedule
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass-card rounded-xl p-5 space-y-4 animate-slide-up">
          <h3 className="text-sm font-semibold text-foreground">New Scheduled Trade</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Instrument */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Instrument
              </label>
              <select
                value={form.instrument}
                onChange={(e) => {
                  const inst = e.target.value;
                  setForm({ ...form, instrument: inst, quantity: lotSize[inst] || 50 });
                }}
                className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="NIFTY">NIFTY</option>
                <option value="BANKNIFTY">BANKNIFTY</option>
                <option value="SENSEX">SENSEX</option>
              </select>
            </div>

            {/* Strategy */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Strategy
              </label>
              <select
                value={form.strategy_type}
                onChange={(e) => setForm({ ...form, strategy_type: e.target.value })}
                className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="straddle">Short Straddle</option>
                <option value="strangle">Short Strangle</option>
              </select>
            </div>

            {/* Schedule Time */}
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

            {/* Quantity */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Lots ({form.quantity} qty)
              </label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>

          {/* Strike Selection Mode */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">
              Strike Selection
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setForm({ ...form, selection_mode: "atm" })}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  form.selection_mode === "atm"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Target className={cn("w-4 h-4", form.selection_mode === "atm" ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="text-xs font-medium text-foreground">ATM</p>
                  <p className="text-[10px] text-muted-foreground">At-the-money strike</p>
                </div>
              </button>
              <button
                onClick={() => setForm({ ...form, selection_mode: "premium_target" })}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  form.selection_mode === "premium_target"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <TrendingDown className={cn("w-4 h-4", form.selection_mode === "premium_target" ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="text-xs font-medium text-foreground">Premium</p>
                  <p className="text-[10px] text-muted-foreground">₹X per lot target</p>
                </div>
              </button>
              <button
                onClick={() => setForm({ ...form, selection_mode: "otm_percent" })}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  form.selection_mode === "otm_percent"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Percent className={cn("w-4 h-4", form.selection_mode === "otm_percent" ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="text-xs font-medium text-foreground">OTM %</p>
                  <p className="text-[10px] text-muted-foreground">X% away from ATM</p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional inputs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {form.selection_mode === "premium_target" && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Target Premium (₹/lot)
                </label>
                <input
                  type="number"
                  value={form.premium_target}
                  onChange={(e) => setForm({ ...form, premium_target: Number(e.target.value) })}
                  className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            )}
            {form.selection_mode === "otm_percent" && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  OTM Distance (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.otm_percent}
                  onChange={(e) => setForm({ ...form, otm_percent: Number(e.target.value) })}
                  className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            )}

            {/* Stop Loss */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Stop Loss (% of premium)
              </label>
              <input
                type="number"
                value={form.stop_loss_percent}
                onChange={(e) => setForm({ ...form, stop_loss_percent: Number(e.target.value) })}
                className="mt-1 w-full bg-muted text-foreground text-xs px-3 py-2 rounded-md border border-border/50 outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>

            {/* Telegram */}
            <div className="flex items-end">
              <button
                onClick={() => setForm({ ...form, telegram_alert: !form.telegram_alert })}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border transition-colors w-full",
                  form.telegram_alert
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                {form.telegram_alert ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                <span className="text-xs font-medium">
                  {form.telegram_alert ? "Telegram ON" : "Telegram OFF"}
                </span>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Create Schedule"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Schedules */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Active Schedules</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{schedules.length} configured</p>
        </div>

        {schedules.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            No scheduled trades. Create one above.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {schedules.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {s.instrument} Short {s.strategy_type === "straddle" ? "Straddle" : "Strangle"}
                      </span>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        s.is_active ? "bg-success/10 text-profit" : "bg-muted text-muted-foreground"
                      )}>
                        {s.is_active ? "ACTIVE" : "PAUSED"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span className="font-mono">{s.schedule_time.slice(0, 5)} IST</span>
                      <span>•</span>
                      <span>
                        {s.selection_mode === "atm"
                          ? "ATM"
                          : s.selection_mode === "premium_target"
                          ? `₹${s.premium_target}/lot`
                          : `${s.otm_percent}% OTM`}
                      </span>
                      <span>•</span>
                      <span>SL: {s.stop_loss_percent}%</span>
                      <span>•</span>
                      <span>Qty: {s.quantity}</span>
                      {s.telegram_alert && (
                        <>
                          <span>•</span>
                          <Bell className="w-3 h-3 text-primary" />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateSchedule(s.id, { is_active: !s.is_active })}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      s.is_active
                        ? "hover:bg-warning/10 text-warning"
                        : "hover:bg-success/10 text-profit"
                    )}
                    title={s.is_active ? "Pause" : "Resume"}
                  >
                    {s.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteSchedule(s.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Executions */}
      {executions.length > 0 && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Recent Executions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  {["Time", "Instrument", "Strategy", "Premium", "SL", "Status"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {executions.map((ex) => (
                  <tr key={ex.id} className="data-row">
                    <td className="px-5 py-3 font-mono text-muted-foreground">
                      {new Date(ex.executed_at).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-3 font-mono text-foreground">{ex.instrument}</td>
                    <td className="px-5 py-3 text-foreground capitalize">{ex.strategy_type}</td>
                    <td className="px-5 py-3 font-mono text-profit">
                      {ex.total_premium ? `₹${ex.total_premium.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-loss">
                      {ex.stop_loss_price ? `₹${ex.stop_loss_price.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded",
                        ex.status === "executed" ? "bg-success/10 text-profit" :
                        ex.status === "failed" ? "bg-destructive/10 text-loss" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {ex.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeScheduler;
