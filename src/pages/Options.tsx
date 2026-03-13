import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import OptionsChain from "@/components/OptionsChain";
import StrategyExecutor from "@/components/StrategyExecutor";
import PayoffChart from "@/components/PayoffChart";
import { getInstrument } from "@/lib/instruments";

export interface SelectedLeg {
  strike: number;
  type: "CE" | "PE";
  ltp: number;
  action: "BUY" | "SELL";
  tradingSymbol?: string;
}

const Options = () => {
  const [selectedLegs, setSelectedLegs] = useState<SelectedLeg[]>([]);
  const [instrument, setInstrument] = useState("NIFTY");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [liveSpot, setLiveSpot] = useState<number | null>(null);
  const inst = getInstrument(instrument);
  const defaultLot = inst?.lotSize || 25;
  const [qty, setQty] = useState(defaultLot);

  const handleStrikeSelect = useCallback(
    (strike: number, type: "CE" | "PE", ltp: number, tradingSymbol?: string) => {
      setSelectedLegs((prev) => {
        const exists = prev.some((l) => l.strike === strike && l.type === type);
        if (exists) return prev.filter((l) => !(l.strike === strike && l.type === type));
        return [...prev, { strike, type, ltp, action: "SELL" as const, tradingSymbol }];
      });
    },
    []
  );

  const handleRemoveLeg = useCallback((strike: number, type: "CE" | "PE") => {
    setSelectedLegs((prev) => prev.filter((l) => !(l.strike === strike && l.type === type)));
  }, []);

  const handleToggleAction = useCallback((strike: number, type: "CE" | "PE") => {
    setSelectedLegs((prev) =>
      prev.map((l) => l.strike === strike && l.type === type ? { ...l, action: l.action === "BUY" ? "SELL" : "BUY" } : l)
    );
  }, []);

  const handleClearAll = useCallback(() => setSelectedLegs([]), []);

  const handleInstrumentChange = useCallback((symbol: string) => {
    setInstrument(symbol);
    setSelectedLegs([]);
    const newInst = getInstrument(symbol);
    setQty(newInst?.lotSize || 25);
  }, []);

  const handleExpiryChange = useCallback((date: Date) => {
    setExpiryDate(date);
  }, []);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Options Chain</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click on LTP values to build strategies · Toggle BUY/SELL per leg
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <OptionsChain
              onStrikeSelect={handleStrikeSelect}
              selectedStrikes={selectedLegs.map((l) => ({ strike: l.strike, type: l.type }))}
              onInstrumentChange={handleInstrumentChange}
              onExpiryChange={handleExpiryChange}
              onSpotPriceChange={setLiveSpot}
            />
            {selectedLegs.length > 0 && (
              <PayoffChart legs={selectedLegs} instrument={instrument} qty={qty} />
            )}
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <StrategyExecutor
              selectedLegs={selectedLegs}
              onRemoveLeg={handleRemoveLeg}
              onToggleAction={handleToggleAction}
              onClearAll={handleClearAll}
              instrument={instrument}
              qty={qty}
              onQtyChange={setQty}
              expiryDate={expiryDate}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Options;
