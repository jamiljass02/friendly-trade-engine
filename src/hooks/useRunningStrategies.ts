import { useEffect, useState } from "react";
import {
  getStrategyRuntimeUpdateEvent,
  listRunningStrategies,
  type RunningStrategyRuntime,
} from "@/lib/strategy-runtime";

export function useRunningStrategies() {
  const [strategies, setStrategies] = useState<RunningStrategyRuntime[]>(() => listRunningStrategies());

  useEffect(() => {
    const sync = () => setStrategies(listRunningStrategies());
    const updateEvent = getStrategyRuntimeUpdateEvent();

    window.addEventListener(updateEvent, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(updateEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return strategies;
}
