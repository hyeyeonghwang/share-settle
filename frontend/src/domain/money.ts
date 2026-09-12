import type { CurrencyCode } from "./types";

interface CurrencyMeta {
  symbol: string;
  decimals: number;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  KRW: { symbol: "₩", decimals: 0, label: "Korean won" },
  JPY: { symbol: "¥", decimals: 0, label: "Japanese yen" },
  USD: { symbol: "$", decimals: 2, label: "US dollar" },
  EUR: { symbol: "€", decimals: 2, label: "Euro" },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** Format a minor-unit integer, e.g. 90000 KRW -> "₩90,000", 1234 USD -> "$12.34". */
export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options: { withSymbol?: boolean; signed?: boolean } = {},
): string {
  const { withSymbol = true, signed = false } = options;
  const meta = CURRENCIES[currency];
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const factor = 10 ** meta.decimals;
  const whole = Math.floor(abs / factor);
  const fraction = abs % factor;
  let text = whole.toLocaleString("en-US");
  if (meta.decimals > 0) text += `.${String(fraction).padStart(meta.decimals, "0")}`;
  if (withSymbol) text = meta.symbol + text;
  if (negative) return `−${text}`;
  if (signed && amount > 0) return `+${text}`;
  return text;
}

/** Parse user input in major units into a minor-unit integer. Returns null when invalid. */
export function parseMoney(input: string, currency: CurrencyCode): number | null {
  const cleaned = input.replace(/[,\s₩$€¥]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** CURRENCIES[currency].decimals);
}

/** Turn a minor-unit integer back into an editable major-unit string. */
export function toInputValue(amount: number | null, currency: CurrencyCode): string {
  if (amount == null) return "";
  const decimals = CURRENCIES[currency].decimals;
  return decimals === 0 ? String(amount) : (amount / 10 ** decimals).toFixed(decimals);
}
