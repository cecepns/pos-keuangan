import { formatIDR } from "./format";

/** Struk HTML untuk window.print — dioptimalkan printer termal (lebar mm) */
export function buildThermalReceiptHtml({
  storeName = "Toko",
  storeAddress = "",
  storePhone = "",
  footer = "",
  widthMm = 80,
  invoiceNo = "—",
  dateStr = "",
  lines = [],
  subtotal = 0,
  discountTotal = 0,
  taxPercent = 0,
  taxAmount = 0,
  grandTotal = 0,
  paidSum = 0,
  changeAmount = 0,
  payments = [],
}) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const lineRows = lines
    .map((c) => {
      const raw = Number(c.discount_amount || 0);
      const sub = Number(c.sell_price) * Number(c.qty);
      const net = sub - raw;
      const discHtml =
        raw > 0
          ? `<div class="small muted">${formatIDR(sub)} → <b>${formatIDR(net)}</b> (diskon ${formatIDR(raw)})</div>`
          : `<div>${formatIDR(net)}</div>`;
      return `<div class="item"><div class="row"><span class="nm">${esc(c.name)}</span></div>
        <div class="row"><span>${c.qty}x ${formatIDR(c.sell_price)}</span></div>${discHtml}</div>`;
    })
    .join("");

  const payRows =
    payments.length > 0
      ? payments
          .map(
            (p) =>
              `<div class="row"><span>${esc(p.method)}</span><span>${formatIDR(p.amount)}</span></div>`
          )
          .join("")
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Struk</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 2mm; }
  html,body{margin:0;padding:0;font-family:system-ui,sans-serif;font-size:11px;}
  .wrap{max-width:${widthMm}mm;margin:0 auto;padding:4px;}
  .c{text-align:center;}
  .h{font-weight:700;font-size:13px;margin:4px 0;}
  .row{display:flex;justify-content:space-between;gap:4px;margin:2px 0;}
  .item{border-bottom:1px dashed #ccc;padding:4px 0;}
  .small{font-size:10px;}
  .muted{color:#555;}
  .tot{font-weight:700;font-size:12px;margin-top:8px;padding-top:6px;border-top:1px solid #000;}
  hr{border:none;border-top:1px dashed #999;margin:6px 0;}
</style></head><body><div class="wrap">
<div class="c h">${esc(storeName)}</div>
${storeAddress ? `<div class="c small">${esc(storeAddress)}</div>` : ""}
${storePhone ? `<div class="c small">${esc(storePhone)}</div>` : ""}
<hr/>
<div class="row small"><span>${esc(invoiceNo)}</span><span>${esc(dateStr)}</span></div>
<hr/>
${lineRows}
<div class="row"><span>Subtotal</span><span>${formatIDR(subtotal)}</span></div>
${discountTotal > 0 ? `<div class="row muted"><span>Diskon total</span><span>- ${formatIDR(discountTotal)}</span></div>` : ""}
${taxPercent > 0 ? `<div class="row muted"><span>Pajak ${taxPercent}%</span><span>${formatIDR(taxAmount)}</span></div>` : ""}
<div class="row tot"><span>TOTAL</span><span>${formatIDR(grandTotal)}</span></div>
${payRows ? `<hr/><div class="small">Bayar:</div>${payRows}` : ""}
${changeAmount > 0 ? `<div class="row" style="font-weight:700"><span>Kembalian</span><span>${formatIDR(changeAmount)}</span></div>` : ""}
${footer ? `<hr/><div class="c small">${esc(footer)}</div>` : ""}
</div><script>window.onload=function(){window.print();}<\/script></body></html>`;
}

export function buildReceiptWhatsAppText({
  storeName,
  invoiceNo,
  dateStr,
  lines,
  subtotal,
  discountTotal,
  taxPercent,
  taxAmount,
  grandTotal,
  changeAmount,
  payments,
}) {
  const hdr = `${storeName}\n${invoiceNo} · ${dateStr}\n---\n`;
  const items = lines
    .map((c) => {
      const d = Number(c.discount_amount || 0);
      const sub = Number(c.sell_price) * Number(c.qty);
      const net = sub - d;
      let t = `${c.qty}x ${c.name} @ ${formatIDR(c.sell_price)}`;
      if (d > 0) t += `\n   ${formatIDR(sub)} → ${formatIDR(net)} (diskon ${formatIDR(d)})`;
      else t += ` = ${formatIDR(net)}`;
      return t;
    })
    .join("\n");
  let foot = `\n---\nSubtotal ${formatIDR(subtotal)}`;
  if (discountTotal > 0) foot += `\nDiskon -${formatIDR(discountTotal)}`;
  if (taxPercent > 0) foot += `\nPajak ${taxPercent}% ${formatIDR(taxAmount)}`;
  foot += `\n*TOTAL ${formatIDR(grandTotal)}*`;
  if (payments?.length)
    foot += `\nBayar:\n${payments.map((p) => `- ${p.method}: ${formatIDR(p.amount)}`).join("\n")}`;
  if (changeAmount > 0) foot += `\nKembalian: ${formatIDR(changeAmount)}`;
  foot += "\n\nTerima kasih.";
  return hdr + items + foot;
}
