export const settingKeys = [
  "from",
  "billTo",
  "shipTo",
  "notes",
  "itemLabel",
  "hourlyRate",
  "currency",
  "taxPercent",
  "invoiceTitle",
  "numberPrefix",
  "nextNumber",
  "paymentTerms",
  "terms",
] as const;
export type Settings = Record<(typeof settingKeys)[number], string>;
export const defaults: Settings = Object.fromEntries(
  settingKeys.map((key) => [key, ""]),
) as Settings;
export interface Invoice {
  settings: Settings;
  hours: string;
  date: string;
  number: string;
}
export interface AppState {
  version: 2;
  configured: boolean;
  settings: Settings;
}
export function parseSettings(input: unknown): Settings {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid settings.");
  const data = input as Record<string, unknown>;
  const result = { ...defaults };
  for (const key of settingKeys) {
    if (typeof data[key] !== "string" || data[key].length > 1500)
      throw new Error(`Invalid setting: ${key}.`);
    result[key] = data[key];
  }
  return result;
}
export function parseState(raw: string | null): AppState {
  if (raw === null)
    return { version: 2, configured: false, settings: { ...defaults } };
  const data = JSON.parse(raw) as AppState;
  if (data.version !== 2 || typeof data.configured !== "boolean")
    throw new Error("Unsupported saved configuration.");
  return {
    version: 2,
    configured: data.configured,
    settings: parseSettings(data.settings),
  };
}
export function parseTemplate(raw: string): Settings {
  const data = JSON.parse(raw) as { version?: number; settings?: unknown };
  if (data.version !== 1) throw new Error("Unsupported template version.");
  // Templates never supply a rate. The person using the template enters their own.
  return { ...parseSettings(data.settings), hourlyRate: "" };
}
export function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function defaultDate(today = new Date()): {
  date: string;
  reason: string;
} {
  const y = today.getFullYear(),
    m = today.getMonth(),
    day = today.getDate();
  const last = new Date(y, m + 1, 0).getDate();
  if (day <= 10)
    return {
      date: localISO(new Date(y, m, 0)),
      reason: "First 10 days: billing the previous month.",
    };
  if (day >= last - 9)
    return {
      date: localISO(new Date(y, m + 1, 0)),
      reason: "Last 10 days: billing the current month.",
    };
  return { date: "", reason: "Mid-month: choose the billing date explicitly." };
}
export function scaled(
  value: string,
  name: string,
  maximum: number,
  allowZero = false,
): number {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))
    throw new Error(`${name}: enter a number with up to two decimal places.`);
  const [whole, fraction = ""] = value.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if ((allowZero ? n < 0 : n <= 0) || n > maximum * 100)
    throw new Error(
      `${name}: enter ${allowZero ? "0" : "a positive value"} to ${maximum.toLocaleString("en-US")}.`,
    );
  return n;
}
function roundRatio(numerator: bigint, denominator: bigint): number {
  const result = Number((numerator + denominator / 2n) / denominator);
  if (!Number.isSafeInteger(result)) throw new Error("Amount is too large.");
  return result;
}
export function amounts(
  hours: string,
  rate: string,
  taxPercent: string = "0",
): { subtotal: number; tax: number; total: number } {
  const h = scaled(hours, "Hours", 10000),
    r = scaled(rate, "Hourly rate", 1000000),
    t = scaled(taxPercent, "Tax percentage", 100, true);
  const subtotal = roundRatio(BigInt(h) * BigInt(r), 100n);
  const tax = roundRatio(BigInt(subtotal) * BigInt(t), 10000n);
  return { subtotal, tax, total: subtotal + tax };
}
export function validateCurrency(value: string): void {
  if (
    !/^[A-Z]{3}$/.test(value) ||
    !Intl.supportedValuesOf("currency").includes(value)
  )
    throw new Error(
      "Enter a supported three-letter currency code, such as USD, EUR, or UYU.",
    );
  if (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: value,
    }).resolvedOptions().maximumFractionDigits !== 2
  )
    throw new Error(
      "This version supports currencies with two decimal places.",
    );
}
export const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  return y >= 2000 && y <= 2199 && localISO(new Date(y, m - 1, d)) === value;
}
export function validateSettings(s: Settings): void {
  parseSettings(s);
  for (const [key, label] of [
    ["from", "From"],
    ["billTo", "Bill To"],
    ["itemLabel", "Line item label"],
    ["invoiceTitle", "Invoice title"],
  ] as const) {
    if (!s[key].trim()) throw new Error(`${label} is required.`);
  }
  if (
    s.itemLabel.length > 180 ||
    s.invoiceTitle.length > 30 ||
    s.numberPrefix.length > 20
  )
    throw new Error("Use a shorter item label, title, or invoice prefix.");
  scaled(s.hourlyRate, "Hourly rate", 1000000);
  scaled(s.taxPercent, "Tax percentage", 100, true);
  validateCurrency(s.currency);
  if (!/^\d{1,9}$/.test(s.nextNumber) || Number(s.nextNumber) < 1)
    throw new Error(
      "Invoice number must be a positive whole number with at most nine digits.",
    );
}
export function validateInvoice(i: Invoice): void {
  validateSettings(i.settings);
  amounts(i.hours, i.settings.hourlyRate, i.settings.taxPercent);
  if (!validDate(i.date))
    throw new Error("Choose a valid invoice date between 2000 and 2199.");
  if (!/^\d{1,9}$/.test(i.number) || Number(i.number) < 1)
    throw new Error("Invalid invoice number.");
}
export function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}
