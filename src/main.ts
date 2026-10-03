import "./style.css";
import {
  defaults,
  defaultDate,
  localISO,
  money,
  amounts,
  validDate,
  validateSettings,
  parseTemplate,
  type Settings,
  type AppState,
} from "./domain";
import { generatePDF } from "./pdf";
import { loadState, saveState, savePDF } from "./storage";
const app = document.querySelector<HTMLDivElement>("#app")!;
const fields: [keyof Settings, string, string, boolean][] = [
  ["from", "From / your name and details", "textarea", true],
  ["billTo", "Bill To", "textarea", true],
  ["shipTo", "Ship To / address", "textarea", false],
  ["itemLabel", "Line item label", "text", true],
  ["hourlyRate", "Hourly rate", "decimal", true],
  ["currency", "Currency code", "text", true],
  ["taxPercent", "Tax percentage", "decimal", true],
  ["invoiceTitle", "Invoice title", "text", true],
  ["numberPrefix", "Invoice number prefix", "text", false],
  ["nextNumber", "Next invoice number", "numeric", true],
  ["paymentTerms", "Payment terms", "text", false],
  ["notes", "Notes (email, tax ID, or other details)", "textarea", false],
  ["terms", "Terms", "textarea", false],
];
app.innerHTML = `<main><header><div class="brand"><span class="mark">R</span><span>Recurring Bill</span></div><button id="settings" class="quiet" disabled>Settings</button></header>
<section class="intro"><p class="eyebrow">A MONTH OF WORK. ONE INVOICE.</p><h1>Ready when you are.</h1><p class="subtitle">Your hours, neatly accounted for.</p></section>
<section id="welcome" class="welcome" hidden><p class="eyebrow">MAKE IT YOURS</p><h2>How would you like to start?</h2><p>No personal details or hourly rate are prefilled.</p><div class="starter-cards"><button id="start-empty" class="starter"><strong>Start empty</strong><span>Configure your own client and invoice details.</span></button><button id="welcome-import" class="starter"><strong>Import a template</strong><span>Load a template file, then add your own rate.</span></button></div></section>
<section class="workspace"><div class="form-panel"><div class="panel-top"><span id="rate-pill" class="pill">Set your hourly rate</span><span id="number">Invoice setup</span></div>
<form id="invoice-form"><label for="hours">Hours worked</label><div class="hours-wrap"><input id="hours" type="text" inputmode="decimal" placeholder="Hours" autocomplete="off" required aria-describedby="hours-help"><span>hours</span></div><p id="hours-help" class="hint">Configure your invoice in Settings.</p>
<div class="date-heading"><label for="date">Invoice date</label><button type="button" id="auto-date" class="text-button">Use automatic date</button></div><input id="date" type="date" min="2000-01-01" max="2199-12-31" required><p id="date-help" class="hint"></p><div id="period-choices" class="choices" hidden><button type="button" id="previous" class="quiet">Previous month</button><button type="button" id="current" class="quiet">This month</button></div>
<div id="tax-summary" class="hint" hidden></div><div class="total-row"><span>Total</span><strong id="total">—</strong></div><button class="primary" id="generate" type="submit" disabled>Save invoice PDF <span>↗</span></button><p class="footnote">Generated on your Mac. Your details stay here.</p></form></div>
<aside><p class="eyebrow">RECURRING DETAILS</p><h2 id="client">Your client</h2><p id="address" class="address"></p><div class="divider"></div><p class="small-label">FROM</p><p id="from">Add your details in Settings.</p><p class="small-label">NOTES</p><p id="notes" class="address"></p><p class="settings-note">Same details each month.<br>Make changes in Settings.</p></aside></section><p id="status" role="status" aria-live="polite"></p></main>
<dialog id="settings-dialog"><form id="settings-form"><div class="dialog-head"><div><p class="eyebrow">SET ONCE, REUSE MONTHLY</p><h2>Invoice settings</h2></div><button id="close-settings" type="button" class="quiet" aria-label="Close settings">✕</button></div><div class="template-actions"><button type="button" id="empty-settings" class="quiet">Start empty</button><button type="button" id="import-settings" class="quiet">Import template</button></div><p class="hint">Templates leave your hourly rate blank. Required fields are marked *.</p>${fields.map(([key, label, type, required]) => `<label for="${key}-setting">${label}${required ? " *" : ""}</label>${type === "textarea" ? `<textarea id="${key}-setting" rows="${key === "shipTo" || key === "notes" ? 4 : 2}" maxlength="1500"></textarea>` : `<input id="${key}-setting" type="text" ${type === "decimal" || type === "numeric" ? `inputmode="${type}"` : ""} maxlength="${key === "itemLabel" ? 180 : key === "invoiceTitle" ? 30 : key === "numberPrefix" ? 20 : 100}" ${key === "currency" ? 'placeholder="e.g. USD, EUR, UYU"' : ""}>`}`).join("")}<p class="hint">Use currencies with two decimal places. Tax may be 0. Invoice numbers advance after a successful save. Set a previous number to regenerate an invoice.</p><p id="settings-error" role="alert"></p><button class="primary" id="save-settings" type="submit">Save settings</button></form></dialog><input id="template-file" type="file" accept=".json,.txt,application/json,text/plain" hidden>`;
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let state: AppState = {
  version: 2,
  configured: false,
  settings: { ...defaults },
};
let ready = false,
  busy = false;
const hours = $<HTMLInputElement>("hours"),
  date = $<HTMLInputElement>("date"),
  generate = $<HTMLButtonElement>("generate"),
  dialog = $<HTMLDialogElement>("settings-dialog");
function message(text: string, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
function configured(): boolean {
  try {
    validateSettings(state.settings);
    return state.configured;
  } catch {
    return false;
  }
}
function refreshDetails() {
  const s = state.settings,
    good = configured();
  $("welcome").hidden = good;
  $("client").textContent = s.billTo || "Your client";
  $("address").textContent = s.shipTo;
  $("from").textContent = s.from || "Add your details in Settings.";
  $("notes").textContent = s.notes;
  $("number").textContent = s.nextNumber
    ? `Invoice #${s.numberPrefix}${s.nextNumber}`
    : "Invoice setup";
  $("rate-pill").textContent = good
    ? `${s.currency} · ${money(Math.round(Number(s.hourlyRate) * 100), s.currency)} / hour`
    : "Set your hourly rate";
  update();
}
function update() {
  let valid = false;
  const s = state.settings;
  $("tax-summary").hidden = true;
  try {
    if (!configured()) throw new Error();
    const a = amounts(hours.value, s.hourlyRate, s.taxPercent);
    $("total").textContent = money(a.total, s.currency);
    valid = true;
    hours.setAttribute("aria-invalid", "false");
    $("hours-help").textContent =
      `${s.itemLabel} · ${money(Math.round(Number(s.hourlyRate) * 100), s.currency)} each`;
    if (Number(s.taxPercent) > 0) {
      $("tax-summary").hidden = false;
      $("tax-summary").textContent =
        `Subtotal ${money(a.subtotal, s.currency)} + tax ${money(a.tax, s.currency)} (${s.taxPercent}%)`;
    }
  } catch (e) {
    $("total").textContent = "—";
    hours.setAttribute(
      "aria-invalid",
      hours.value && configured() ? "true" : "false",
    );
    $("hours-help").textContent =
      hours.value && configured()
        ? String(e).replace(/^Error: /, "")
        : configured()
          ? `${s.itemLabel} · Enter your hours.`
          : "Configure your invoice in Settings.";
  }
  generate.disabled = !ready || busy || !valid || !validDate(date.value);
  $<HTMLButtonElement>("settings").disabled = !ready || busy;
}
function automatic() {
  const result = defaultDate();
  date.value = result.date;
  $("date-help").textContent = result.reason;
  $("period-choices").hidden = !!result.date;
  update();
}
hours.addEventListener("input", update);
date.addEventListener("input", () => {
  $("date-help").textContent =
    "Selected by you. This date will appear on the invoice.";
  $("period-choices").hidden = true;
  update();
});
$("auto-date").addEventListener("click", automatic);
for (const [id, offset] of [
  ["previous", 0],
  ["current", 1],
] as const) {
  $(id).addEventListener("click", () => {
    const now = new Date();
    date.value = localISO(
      new Date(now.getFullYear(), now.getMonth() + offset, 0),
    );
    $("date-help").textContent = "Billing period selected by you.";
    $("period-choices").hidden = true;
    update();
  });
}
function fillSettings(s: Settings) {
  for (const [key] of fields)
    $<HTMLInputElement>(`${key}-setting`).value = s[key];
  $("settings-error").textContent = "";
}
function openSettings(s = state.settings) {
  if (!ready || busy) return;
  fillSettings(s);
  dialog.showModal();
}
$("settings").addEventListener("click", () => openSettings());
$("start-empty").addEventListener("click", () => openSettings({ ...defaults }));
$("empty-settings").addEventListener("click", () =>
  fillSettings({ ...defaults }),
);
$("close-settings").addEventListener("click", () => {
  if (!busy) dialog.close();
});
dialog.addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
const fileInput = $<HTMLInputElement>("template-file");
for (const id of ["welcome-import", "import-settings"])
  $(id).addEventListener("click", () => {
    if (ready && !busy) fileInput.click();
  });
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    if (file.size > 32000) throw new Error("Template file is too large.");
    const s = parseTemplate(await file.text());
    if (dialog.open) fillSettings(s);
    else openSettings(s);
  } catch (e) {
    if (dialog.open) $("settings-error").textContent = String(e);
    else message(String(e), true);
  } finally {
    fileInput.value = "";
  }
});
$("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const next = Object.fromEntries(
    fields.map(([key]) => [
      key,
      $<HTMLInputElement>(`${key}-setting`).value.trim(),
    ]),
  ) as Settings;
  next.currency = next.currency.toUpperCase();
  try {
    validateSettings(next);
  } catch (e) {
    $("settings-error").textContent = String(e);
    return;
  }
  busy = true;
  $<HTMLButtonElement>("save-settings").disabled = true;
  update();
  try {
    const nextState: AppState = {
      version: 2,
      configured: true,
      settings: next,
    };
    await saveState(nextState);
    state = nextState;
    dialog.close();
    refreshDetails();
    message("Recurring details saved.");
  } catch (e) {
    $("settings-error").textContent = String(e);
  } finally {
    busy = false;
    $<HTMLButtonElement>("save-settings").disabled = false;
    update();
  }
});
$("invoice-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!ready || busy || !configured()) return;
  busy = true;
  update();
  generate.textContent = "Preparing PDF…";
  message("");
  try {
    const snapshot = {
      settings: { ...state.settings },
      hours: hours.value,
      date: date.value,
      number: state.settings.nextNumber,
    };
    const bytes = generatePDF(snapshot),
      safePrefix = snapshot.settings.numberPrefix.replace(
        /[^a-zA-Z0-9_-]/g,
        "",
      );
    const saved = await savePDF(
      bytes,
      `invoice-${safePrefix}${snapshot.number}-${snapshot.date}.pdf`,
    );
    if (!saved) {
      message("Save cancelled. Invoice number unchanged.");
      return;
    }
    const next = {
      ...state.settings,
      nextNumber: String(Number(state.settings.nextNumber) + 1),
    };
    try {
      const nextState: AppState = {
        version: 2,
        configured: true,
        settings: next,
      };
      await saveState(nextState);
      state = nextState;
      refreshDetails();
      message(
        `Invoice #${snapshot.settings.numberPrefix}${snapshot.number} saved. Next invoice is #${next.numberPrefix}${next.nextNumber}.`,
      );
    } catch (e) {
      message(
        `PDF saved, but the next invoice number could not be stored. Update it in Settings before the next invoice. ${String(e)}`,
        true,
      );
    }
  } catch (e) {
    message(String(e), true);
  } finally {
    busy = false;
    generate.innerHTML = "Save invoice PDF <span>↗</span>";
    update();
  }
});
automatic();
refreshDetails();
loadState()
  .then((saved) => {
    state = saved;
    ready = true;
    refreshDetails();
  })
  .catch((e) =>
    message(
      `Could not load settings. Your saved data has not been replaced. ${String(e)}`,
      true,
    ),
  );
