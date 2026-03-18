export type OptionType = "CE" | "PE";

export function getStrikeOptionsForType(optionType: OptionType): string[] {
  const otmList = Array.from({ length: 20 }, (_, i) => `OTM ${20 - i}`);
  const itmList = Array.from({ length: 20 }, (_, i) => `ITM ${i + 1}`);

  if (optionType === "CE") {
    return [...otmList, "ATM", ...itmList, "CUSTOM"];
  }

  return [...itmList.slice().reverse(), "ATM", ...otmList.slice().reverse(), "CUSTOM"];
}

export function getStrikeColorClass(selection: string): string {
  if (selection === "ATM") return "text-primary";
  if (selection.startsWith("OTM")) return "text-loss";
  if (selection.startsWith("ITM")) return "text-profit";
  return "text-foreground";
}

export function resolveStrikeFromSelection({
  selection,
  optionType,
  spot,
  step,
  customStrike,
}: {
  selection: string;
  optionType: OptionType;
  spot: number;
  step: number;
  customStrike?: number;
}): number | undefined {
  if (selection === "CUSTOM") return customStrike;

  const atmStrike = Math.round(spot / step) * step;
  if (selection === "ATM") return atmStrike;

  const offset = Number.parseInt(selection.split(" ")[1] ?? "0", 10);
  if (!Number.isFinite(offset) || offset <= 0) return customStrike ?? atmStrike;

  if (selection.startsWith("OTM")) {
    const direction = optionType === "CE" ? 1 : -1;
    return atmStrike + offset * step * direction;
  }

  if (selection.startsWith("ITM")) {
    const direction = optionType === "CE" ? -1 : 1;
    return atmStrike + offset * step * direction;
  }

  return customStrike ?? atmStrike;
}
