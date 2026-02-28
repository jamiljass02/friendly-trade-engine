import { useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import OptionsChain from "@/components/OptionsChain";
import StrategyExecutor from "@/components/StrategyExecutor";

interface SelectedLeg {
  strike: number;
  type: "CE" | "PE";
  ltp: number;
}

const Options = () => {
  const [selectedLegs, setSelectedLegs] = useState<SelectedLeg[]>([]);
  const [instrument] = useState("NIFTY");

  const handleStrikeSelect = useCallback(
    (strike: number, type: "CE" | "PE", ltp: number) => {
      setSelectedLegs((prev) => {
        const exists = prev.some((l) => l.strike === strike && l.type === type);
        if (exists) {
          return prev.filter((l) => !(l.strike === strike && l.type === type));
        }
        return [...prev, { strike, type, ltp }];
      });
    },
    []
  );

  const handleRemoveLeg = useCallback((strike: number, type: "CE" | "PE") => {
    setSelectedLegs((prev) =>
      prev.filter((l) => !(l.strike === strike && l.type === type))
    );
  }, []);

  const handleClearAll = useCallback(() => setSelectedLegs([]), []);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Options Chain</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click on LTP values to build Short Straddle/Strangle strategies
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          <OptionsChain
            onStrikeSelect={handleStrikeSelect}
            selectedStrikes={selectedLegs.map((l) => ({
              strike: l.strike,
              type: l.type,
            }))}
          />
          <StrategyExecutor
            selectedLegs={selectedLegs}
            onRemoveLeg={handleRemoveLeg}
            onClearAll={handleClearAll}
            instrument={instrument}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Options;
