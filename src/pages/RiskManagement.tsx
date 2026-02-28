import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import { useRiskSettings, type RiskSettings } from "@/hooks/useRiskSettings";
import { usePositions } from "@/hooks/usePositions";
import {
  Shield, AlertTriangle, Zap, Activity, TrendingUp, BarChart3,
  Save, Power, AlertOctagon, Gauge, Target, Ban, ChevronDown, ChevronUp,
} from "lucide-react";

const INDICES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"];
function extractUnderlying(symbol: string): string {
  const match = symbol.match(/^([A-Z&]+)\d/);
  return match ? match[1] : symbol;
}

// Sectors from instruments
const SECTOR_MAP: Record<string, string> = {
  RELIANCE: "Oil & Gas", TCS: "IT", HDFCBANK: "Banking", INFY: "IT", ICICIBANK: "Banking",
  SBIN: "Banking", BHARTIARTL: "Telecom", ITC: "FMCG", KOTAKBANK: "Banking", TATAMOTORS: "Auto",
  BAJFINANCE: "NBFC", AXISBANK: "Banking", LT: "Infra", SUNPHARMA: "Pharma", TATASTEEL: "Metals",
};

const NumberInput = ({ label, value, onChange, suffix, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number; step?: number;
}) => (
  <div className="space-y-1">
    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</label>
    <div className="relative">
      <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step || 1}
        className="w-full px-3 py-2 rounded-lg bg-muted border border-border/50 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

const RiskGauge = ({ label, current, limit, unit, inverse }: {
  label: string; current: number; limit: number; unit: string; inverse?: boolean;
}) => {
  const pct = limit !== 0 ? Math.abs(current / limit) * 100 : 0;
  const breached = inverse ? current < limit : current > limit;
  const warning = inverse ? current < limit * 1.2 : pct > 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className={cn("text-[10px] font-mono font-bold", breached ? "text-loss" : warning ? "text-warning" : "text-foreground")}>
          {current.toLocaleString("en-IN", { maximumFractionDigits: 0 })}{unit} / {limit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}{unit}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500",
          breached ? "bg-loss" : warning ? "bg-warning" : "bg-profit"
        )} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {breached && (
        <div className="flex items-center gap-1 text-[9px] text-loss">
          <AlertTriangle className="w-2.5 h-2.5" /> LIMIT BREACHED
        </div>
      )}
    </div>
  );
};

const RiskManagement = () => {
  const { settings, loading, saving, saveSettings, toggleKillSwitch } = useRiskSettings();
  const { positions } = usePositions();
  const [draft, setDraft] = useState<Partial<RiskSettings>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["monitor", "position", "stoploss", "daily", "greeks", "margin"]));
  const [confirmKill, setConfirmKill] = useState(false);

  const merged = { ...settings, ...draft } as RiskSettings;
  const update = (key: keyof RiskSettings, val: any) => setDraft((p) => ({ ...p, [key]: val }));
  const hasChanges = Object.keys(draft).length > 0;

  const handleSave = () => { saveSettings(draft); setDraft({}); };
  const toggleSection = (s: string) => setExpandedSections((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  // Live risk metrics from positions
  const riskMetrics = useMemo(() => {
    let indexExposure = 0, stockExposure = 0, totalPnl = 0;
    let netDelta = 0, netGamma = 0, netVega = 0, netTheta = 0;
    const sectorExposure: Record<string, number> = {};
    const assetCounts: Record<string, number> = {};

    for (const p of positions) {
      const underlying = extractUnderlying(p.symbol);
      const isIndex = INDICES.includes(underlying);
      const exposure = p.avgPrice * p.qty;

      if (isIndex) indexExposure += exposure;
      else {
        stockExposure += exposure;
        const sector = SECTOR_MAP[underlying] || "Other";
        sectorExposure[sector] = (sectorExposure[sector] || 0) + exposure;
      }

      assetCounts[underlying] = (assetCounts[underlying] || 0) + 1;
      totalPnl += p.pnl;

      const mult = p.side === "BUY" ? 1 : -1;
      if (p.type === "FUT") {
        netDelta += mult * p.qty;
      } else {
        const d = p.type === "CE" ? 0.5 : -0.5;
        netDelta += d * mult * p.qty;
        netGamma += 0.002 * p.qty;
        netTheta += (p.side === "SELL" ? 1 : -1) * p.ltp * 0.05 * p.qty;
        netVega += 0.1 * p.qty;
      }
    }

    const totalExposure = indexExposure + stockExposure;
    const marginUsed = positions.reduce((s, p) => {
      const n = p.avgPrice * p.qty;
      return s + (p.type === "FUT" ? n * 0.12 : p.side === "SELL" ? n * 0.15 : n * 0.05);
    }, 0);
    const marginUtil = totalExposure > 0 ? (marginUsed / 500000) * 100 : 0;

    const maxSectorPct = Object.values(sectorExposure).length > 0
      ? (Math.max(...Object.values(sectorExposure)) / (stockExposure || 1)) * 100 : 0;
    const maxPositionsPerAsset = Object.values(assetCounts).length > 0 ? Math.max(...Object.values(assetCounts)) : 0;

    return {
      indexExposure, stockExposure, totalPnl, netDelta, netGamma, netVega, netTheta,
      marginUsed, marginUtil, sectorExposure, maxSectorPct, maxPositionsPerAsset,
    };
  }, [positions]);

  const breaches = useMemo(() => {
    const b: string[] = [];
    if (riskMetrics.indexExposure > merged.max_index_exposure) b.push("Index exposure exceeded");
    if (riskMetrics.stockExposure > merged.max_stock_exposure) b.push("Stock exposure exceeded");
    if (riskMetrics.maxSectorPct > merged.max_sector_concentration_pct) b.push("Sector concentration exceeded");
    if (Math.abs(riskMetrics.netDelta) > merged.max_delta) b.push("Delta limit exceeded");
    if (riskMetrics.netGamma > merged.max_gamma) b.push("Gamma limit exceeded");
    if (riskMetrics.netVega > merged.max_vega) b.push("Vega limit exceeded");
    if (riskMetrics.netTheta < merged.max_theta) b.push("Theta limit exceeded");
    if (riskMetrics.marginUtil > merged.max_margin_utilization_pct) b.push("Margin utilization exceeded");
    if (Math.abs(riskMetrics.totalPnl) > merged.daily_loss_limit && riskMetrics.totalPnl < 0) b.push("Daily loss limit breached");
    return b;
  }, [riskMetrics, merged]);

  const Section = ({ id, icon: Icon, title, children, color }: { id: string; icon: typeof Shield; title: string; children: React.ReactNode; color?: string }) => {
    const open = expandedSections.has(id);
    return (
      <div className="glass-card rounded-xl overflow-hidden">
        <button onClick={() => toggleSection(id)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-secondary/20 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className={cn("p-1.5 rounded-lg bg-secondary/50", color || "text-primary")}><Icon className="w-4 h-4" /></div>
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {open && <div className="px-5 pb-5 pt-2 border-t border-border/50">{children}</div>}
      </div>
    );
  };

  if (loading) return (
    <AppLayout>
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Risk Management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Configure limits, monitor exposure & manage risk</p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        {/* Kill Switch + Breach Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          {/* Breach Alerts */}
          {breaches.length > 0 && (
            <div className="space-y-2 lg:col-span-2">
              {breaches.map((b, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
                  <AlertOctagon className="w-4 h-4 text-loss shrink-0" />
                  <span className="text-xs font-medium text-loss">{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Kill Switch Card */}
          <div className={cn("glass-card rounded-xl p-5 lg:col-span-2",
            settings.kill_switch_active ? "border-2 border-destructive bg-destructive/5" : ""
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", settings.kill_switch_active ? "bg-destructive/20 text-loss" : "bg-secondary/50 text-muted-foreground")}>
                  <Power className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Emergency Kill Switch</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {settings.kill_switch_active
                      ? `Activated at ${new Date(settings.kill_switch_activated_at || "").toLocaleString()}`
                      : "Instantly blocks all new orders when activated"
                    }
                  </p>
                </div>
              </div>
              {!confirmKill ? (
                <button onClick={() => setConfirmKill(true)}
                  className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-colors",
                    settings.kill_switch_active
                      ? "bg-profit text-primary-foreground hover:bg-profit/90"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  )}>
                  {settings.kill_switch_active ? "DEACTIVATE" : "ACTIVATE KILL SWITCH"}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-loss font-medium">Confirm?</span>
                  <button onClick={() => { toggleKillSwitch(!settings.kill_switch_active); setConfirmKill(false); }}
                    className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold">
                    YES
                  </button>
                  <button onClick={() => setConfirmKill(false)}
                    className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
          {/* Left: Settings */}
          <div className="space-y-4">
            <Section id="position" icon={Target} title="Position Limits">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput label="Max Index Exposure" value={merged.max_index_exposure} onChange={(v) => update("max_index_exposure", v)} suffix="₹" />
                <NumberInput label="Max Stock Exposure" value={merged.max_stock_exposure} onChange={(v) => update("max_stock_exposure", v)} suffix="₹" />
                <NumberInput label="Max Sector Concentration" value={merged.max_sector_concentration_pct} onChange={(v) => update("max_sector_concentration_pct", v)} suffix="%" min={0} max={100} />
                <NumberInput label="Max Positions per Asset" value={merged.max_positions_per_asset} onChange={(v) => update("max_positions_per_asset", v)} min={1} max={50} />
              </div>
            </Section>

            <Section id="stoploss" icon={Shield} title="Stop Loss Configuration" color="text-warning">
              <div className="grid grid-cols-3 gap-4">
                <NumberInput label="Index Options SL" value={merged.index_sl_pct} onChange={(v) => update("index_sl_pct", v)} suffix="%" />
                <NumberInput label="Stock Options SL" value={merged.stock_sl_pct} onChange={(v) => update("stock_sl_pct", v)} suffix="%" />
                <NumberInput label="Futures SL" value={merged.futures_sl_pct} onChange={(v) => update("futures_sl_pct", v)} suffix="%" />
              </div>
            </Section>

            <Section id="daily" icon={Ban} title="Daily Loss Limit" color="text-loss">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <NumberInput label="Daily Loss Limit" value={merged.daily_loss_limit} onChange={(v) => update("daily_loss_limit", v)} suffix="₹" />
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Auto-Shutdown</label>
                    <button onClick={() => update("daily_loss_auto_shutdown", !merged.daily_loss_auto_shutdown)}
                      className={cn("w-full px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                        merged.daily_loss_auto_shutdown
                          ? "bg-destructive/10 border-destructive/30 text-loss"
                          : "bg-muted border-border/50 text-muted-foreground"
                      )}>
                      {merged.daily_loss_auto_shutdown ? "Enabled — will block orders" : "Disabled"}
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="greeks" icon={Activity} title="Greeks Limits" color="text-accent-foreground">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput label="Max Absolute Delta" value={merged.max_delta} onChange={(v) => update("max_delta", v)} />
                <NumberInput label="Max Gamma" value={merged.max_gamma} onChange={(v) => update("max_gamma", v)} />
                <NumberInput label="Max Vega" value={merged.max_vega} onChange={(v) => update("max_vega", v)} />
                <NumberInput label="Max Theta (negative)" value={merged.max_theta} onChange={(v) => update("max_theta", v)} />
              </div>
            </Section>

            <Section id="margin" icon={Gauge} title="Margin Monitoring">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput label="Max Margin Utilization" value={merged.max_margin_utilization_pct} onChange={(v) => update("max_margin_utilization_pct", v)} suffix="%" min={0} max={100} />
                <NumberInput label="Alert Threshold" value={merged.margin_alert_threshold_pct} onChange={(v) => update("margin_alert_threshold_pct", v)} suffix="%" min={0} max={100} />
              </div>
            </Section>
          </div>

          {/* Right: Live Monitor */}
          <div className="space-y-4">
            <Section id="monitor" icon={BarChart3} title="Live Risk Monitor">
              <div className="space-y-4">
                <RiskGauge label="Index Exposure" current={riskMetrics.indexExposure} limit={merged.max_index_exposure} unit="₹" />
                <RiskGauge label="Stock Exposure" current={riskMetrics.stockExposure} limit={merged.max_stock_exposure} unit="₹" />
                <RiskGauge label="Sector Concentration" current={riskMetrics.maxSectorPct} limit={merged.max_sector_concentration_pct} unit="%" />
                <RiskGauge label="Margin Utilization" current={riskMetrics.marginUtil} limit={merged.max_margin_utilization_pct} unit="%" />

                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">Greeks Exposure</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Delta", current: riskMetrics.netDelta, limit: merged.max_delta },
                      { label: "Gamma", current: riskMetrics.netGamma, limit: merged.max_gamma },
                      { label: "Vega", current: riskMetrics.netVega, limit: merged.max_vega },
                      { label: "Theta", current: riskMetrics.netTheta, limit: merged.max_theta },
                    ].map((g) => {
                      const pct = g.limit !== 0 ? Math.abs(g.current / g.limit) * 100 : 0;
                      const breached = g.label === "Theta" ? g.current < g.limit : Math.abs(g.current) > Math.abs(g.limit);
                      return (
                        <div key={g.label} className="bg-secondary/30 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-muted-foreground uppercase">{g.label}</span>
                            {breached && <AlertTriangle className="w-2.5 h-2.5 text-loss" />}
                          </div>
                          <p className={cn("text-sm font-mono font-bold", breached ? "text-loss" : "text-foreground")}>
                            {g.current.toFixed(1)}
                          </p>
                          <p className="text-[8px] text-muted-foreground font-mono">Limit: {g.limit}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">Daily P&L</p>
                  <RiskGauge
                    label="Today's Loss"
                    current={Math.abs(Math.min(0, riskMetrics.totalPnl))}
                    limit={merged.daily_loss_limit}
                    unit="₹"
                  />
                </div>

                {/* Sector Breakdown */}
                {Object.keys(riskMetrics.sectorExposure).length > 0 && (
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">Sector Exposure</p>
                    <div className="space-y-1.5">
                      {Object.entries(riskMetrics.sectorExposure)
                        .sort(([, a], [, b]) => b - a)
                        .map(([sector, exposure]) => {
                          const pct = riskMetrics.stockExposure > 0 ? (exposure / riskMetrics.stockExposure) * 100 : 0;
                          return (
                            <div key={sector} className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground w-16 truncate">{sector}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={cn("h-full rounded-full", pct > merged.max_sector_concentration_pct ? "bg-loss" : "bg-primary")}
                                  style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                              <span className="text-[9px] font-mono text-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default RiskManagement;
