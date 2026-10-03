import { jsPDF } from "jspdf";
import {
  displayDate,
  money,
  amounts,
  scaled,
  validateInvoice,
  type Invoice,
} from "./domain";
export function generatePDF(invoice: Invoice): Uint8Array {
  validateInvoice(invoice);
  const { settings: s, date, hours, number } = invoice;
  const calculated = amounts(hours, s.hourlyRate, s.taxPercent);
  const format = (cents: number) => money(cents, s.currency);
  const total = format(calculated.total);
  const invoiceNumber = s.numberPrefix + number;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setProperties({
    title: `${s.invoiceTitle} ${invoiceNumber}`,
    author: s.from,
    subject: s.itemLabel,
  });
  const left = 44,
    right = 551,
    bottom = 790;
  const font = (size: number, bold = false, color = 55) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const block = (
    text: string,
    x: number,
    y: number,
    width: number,
    size = 10,
    bold = false,
  ) => {
    font(size, bold);
    const lines = doc.splitTextToSize(text, width) as string[];
    if (y + lines.length * size * 1.15 > 520)
      throw new Error(
        "Recurring address details are too long for the invoice header. Shorten them in Settings.",
      );
    doc.text(lines, x, y);
    return y + lines.length * size * 1.15;
  };
  const needPage = (y: number, height: number) => {
    if (y + height > bottom) {
      doc.addPage();
      return 55;
    }
    return y;
  };
  font(12, true);
  const fromEnd = block(s.from, left, 51, 265, 12, true);
  font(28);
  let titleSize = 28;
  while (doc.getTextWidth(s.invoiceTitle) > 230 && titleSize > 12) {
    font(--titleSize);
  }
  if (doc.getTextWidth(s.invoiceTitle) > 230)
    throw new Error("Use a shorter invoice title.");
  doc.text(s.invoiceTitle, right, 62, { align: "right" });
  font(12, false, 115);
  doc.text(`# ${invoiceNumber}`, right, 83, { align: "right" });
  let y = Math.max(140, fromEnd + 32);
  font(10, false, 115);
  doc.text("Bill To:", left, y);
  if (s.shipTo.trim()) doc.text("Ship To:", 205, y);
  const billEnd = block(s.billTo, left, y + 19, 145, 10, true);
  const shipEnd = s.shipTo.trim()
    ? block(s.shipTo, 205, y + 19, 145, 10, true)
    : y + 19;
  font(10, false, 115);
  doc.text("Date:", 400, y);
  font(10);
  doc.text(displayDate(date), right, y, { align: "right" });
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(382, y + 13, 169, 30, 3, 3, "F");
  font(10, true);
  doc.text("Balance Due:", 391, y + 32);
  doc.text(total, 541, y + 32, { align: "right" });
  if (s.paymentTerms.trim()) {
    const termsEnd = block(
      "Payment terms: " + s.paymentTerms,
      left,
      Math.max(billEnd, shipEnd) + 20,
      right - left,
      10,
    );
    y = Math.max(y, termsEnd);
  }
  y = Math.max(270, y + 45, billEnd + 45, shipEnd + 45);
  y = needPage(y, 140);
  doc.setFillColor(55, 55, 55);
  doc.roundedRect(left, y, right - left, 25, 3, 3, "F");
  font(10, false, 255);
  doc.text("Item", left + 12, y + 16);
  doc.text("Quantity", 380, y + 16, { align: "right" });
  doc.text("Rate", 450, y + 16, { align: "right" });
  doc.text("Amount", right - 12, y + 16, { align: "right" });
  font(10, true);
  const itemLines = doc.splitTextToSize(s.itemLabel, 240) as string[];
  doc.text(itemLines, left + 12, y + 47);
  font(10);
  doc.text(String(Number(hours)), 380, y + 47, { align: "right" });
  doc.text(format(scaled(s.hourlyRate, "Hourly rate", 1000000)), 450, y + 47, {
    align: "right",
  });
  doc.text(format(calculated.subtotal), right - 12, y + 47, { align: "right" });
  y += Math.max(105, 65 + itemLines.length * 12);
  for (const [label, value] of [
    ["Subtotal:", format(calculated.subtotal)],
    [`Tax (${Number(s.taxPercent)}%):`, format(calculated.tax)],
    ["Total:", total],
  ]) {
    font(10, label === "Total:", label === "Total:" ? 55 : 115);
    doc.text(label, 440, y, { align: "right" });
    font(10, label === "Total:");
    doc.text(value, right - 12, y, { align: "right" });
    y += 23;
  }
  for (const [heading, content] of [
    ["Notes:", s.notes],
    ["Terms:", s.terms],
  ]) {
    if (content.trim()) {
      y = needPage(y + 34, 40);
      font(10, false, 115);
      doc.text(heading, left, y);
      y += 19;
      font(10);
      const lines = doc.splitTextToSize(content, right - left) as string[];
      for (const line of lines) {
        y = needPage(y, 14);
        doc.text(line, left, y);
        y += 14;
      }
    }
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
