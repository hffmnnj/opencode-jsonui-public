const channels = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));

export function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map(value => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}

export function contrastText(background: string): string {
  const light = luminance(background);
  return (light + 0.05) / 0.05 >= 1.05 / (light + 0.05) ? "#000000" : "#FFFFFF";
}

export function mixColor(from: string, to: string, amount: number): string {
  const target = channels(to), ratio = Math.max(0, Math.min(1, amount));
  return `#${channels(from).map((channel, index) => Math.round(channel + (target[index]! - channel) * ratio).toString(16).padStart(2, "0")).join("")}`;
}
