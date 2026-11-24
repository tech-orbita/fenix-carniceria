export type WholesaleDisplayLine = {
  quantity: number;
  unit: string;
  detail?: string;
  exactLabel?: string;
};

export function formatWholesaleDisplayLines(
  lines: WholesaleDisplayLine[],
  formatQuantity: (quantity: number) => string,
  unspecifiedUnit: string,
) {
  return lines.map((line) => {
    if (line.exactLabel) return line.exactLabel;
    const shownUnit = line.unit && line.unit !== unspecifiedUnit ? ` ${line.unit}` : "";
    return `${formatQuantity(line.quantity)}${shownUnit}${line.detail ? ` ${line.detail}` : ""}`;
  }).join(" / ");
}
