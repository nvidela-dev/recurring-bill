import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  defaultDate,
  amounts,
  validDate,
  validateSettings,
  validateInvoice,
  parseState,
  parseTemplate,
  type Settings,
} from "../src/domain";
import { generatePDF } from "../src/pdf";
const configured: Settings = {
  ...defaults,
  from: "Example Engineer",
  billTo: "Example Client",
  shipTo: "Example Address",
  notes: "Contact: example@example.test",
  itemLabel: "Engineering Hours",
  hourlyRate: "37.50",
  currency: "USD",
  taxPercent: "0",
  invoiceTitle: "INVOICE",
  nextNumber: "1",
};
test("fresh installs contain no personal or billing defaults", () => {
  assert.ok(Object.values(defaults).every((v) => v === ""));
  assert.deepEqual(parseState(null), {
    version: 2,
    configured: false,
    settings: defaults,
  });
  assert.throws(() => validateSettings(defaults));
});
test("imported templates never preset an hourly rate", () => {
  const imported = parseTemplate(
    JSON.stringify({ version: 1, settings: configured }),
  );
  assert.equal(imported.hourlyRate, "");
  assert.equal(imported.billTo, "Example Client");
  assert.throws(() => validateSettings(imported));
});
test("configuration validates arbitrary rates, labels, titles, numbering, and currency", () => {
  assert.doesNotThrow(() =>
    validateSettings({
      ...configured,
      currency: "EUR",
      itemLabel: "Consulting",
      invoiceTitle: "INVOICE",
      numberPrefix: "INV-",
      nextNumber: "18",
      hourlyRate: "42.75",
      taxPercent: "7.5",
    }),
  );
  for (const hourlyRate of ["", "0", "-1", "NaN", "1e2", "1.001", "1000001"])
    assert.throws(() => validateSettings({ ...configured, hourlyRate }));
  for (const currency of ["", "XYZ", "JPY"])
    assert.throws(() => validateSettings({ ...configured, currency }));
  assert.throws(() => validateSettings({ ...configured, taxPercent: "101" }));
});
test("first ten days include January rollover and leap years", () => {
  assert.equal(defaultDate(new Date(2026, 0, 1)).date, "2025-12-31");
  assert.equal(defaultDate(new Date(2024, 2, 10)).date, "2024-02-29");
  assert.equal(defaultDate(new Date(2026, 2, 10)).date, "2026-02-28");
});
test("last ten days start inclusively and middle requires a choice", () => {
  for (const [y, m, start, end] of [
    [2026, 0, 22, 31],
    [2026, 3, 21, 30],
    [2026, 1, 19, 28],
    [2024, 1, 20, 29],
  ]) {
    assert.equal(defaultDate(new Date(y, m, start - 1)).date, "");
    assert.equal(
      defaultDate(new Date(y, m, start)).date,
      `${y}-${String(m + 1).padStart(2, "0")}-${end}`,
    );
    assert.equal(
      defaultDate(new Date(y, m, end)).date,
      `${y}-${String(m + 1).padStart(2, "0")}-${end}`,
    );
  }
  assert.equal(defaultDate(new Date(2026, 9, 11)).date, "");
});
test("decimal rates and hours use exact cents and round once, half up", () => {
  assert.deepEqual(amounts("160.25", "37.50", "0"), {
    subtotal: 600938,
    tax: 0,
    total: 600938,
  });
  assert.deepEqual(amounts("0.01", "0.50", "0"), {
    subtotal: 1,
    tax: 0,
    total: 1,
  });
  assert.deepEqual(amounts("2", "42.75", "7.5"), {
    subtotal: 8550,
    tax: 641,
    total: 9191,
  });
  for (const hours of [
    "0",
    "-1",
    "NaN",
    "1e2",
    "1.001",
    "10001",
    "Infinity",
    "",
  ])
    assert.throws(() => amounts(hours, "37.50"));
});
test("manual overrides accept dates other than month end", () => {
  assert.equal(validDate("2026-02-29"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.doesNotThrow(() =>
    validateInvoice({
      settings: configured,
      hours: "160",
      date: "2026-09-17",
      number: "1",
    }),
  );
});
test("saved settings roundtrip without losing user-selected fields", () => {
  const state = { version: 2, configured: true, settings: configured };
  assert.deepEqual(parseState(JSON.stringify(state)), state);
  assert.throws(() => parseState("{invalid"));
  assert.throws(() =>
    parseState(JSON.stringify({ version: 1, settings: configured })),
  );
});
test("PDF uses custom rate, currency, item, number, tax, and notes", () => {
  const s = {
    ...configured,
    currency: "EUR",
    itemLabel: "Consulting Hours",
    numberPrefix: "ENG-",
    hourlyRate: "42.75",
    taxPercent: "7.5",
    paymentTerms: "NET 30",
    terms: "Thank you.",
  };
  const bytes = generatePDF({
    settings: s,
    hours: "2",
    date: "2026-09-17",
    number: "18",
  });
  const text = new TextDecoder().decode(bytes);
  for (const value of [
    "%PDF-",
    "Example Engineer",
    "Example Client",
    "Consulting Hours",
    "ENG-18",
    "42.75",
    "85.50",
    "91.91",
    "NET 30",
    "Thank you.",
    "example@example.test",
  ])
    assert.ok(text.includes(value), value);
  assert.ok(text.includes("Example Engineer"));
});
