import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const safe = (v) => (v === undefined || v === null ? "" : String(v));

export function downloadInvoicePdf(order) {
  if (!order?._id) throw new Error("Order is missing");

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 40;
  let y = 48;

  const invoiceNo = `INV-${String(order._id).slice(-8).toUpperCase()}`;
  const orderNo = `ORD-${String(order._id).slice(-8).toUpperCase()}`;
  const invoiceDate = order.createdAt ? new Date(order.createdAt) : new Date();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Ruvia Cosmetics", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 18;
  doc.text("Invoice", marginX, y);

  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoiceNo}`, 360, 48);
  doc.text(`Order No: ${orderNo}`, 360, 62);
  doc.text(`Date: ${invoiceDate.toLocaleDateString("en-IN")}`, 360, 76);
  doc.text(`Payment: ${safe(order.paymentMethod || "")}`, 360, 90);

  y += 28;
  doc.setDrawColor(230);
  doc.line(marginX, y, 555, y);
  y += 16;

  // Addresses
  const sa = order.shippingAddress || {};
  const name = [sa.firstName, sa.lastName].filter(Boolean).join(" ").trim();
  const addressLine1 = sa.address || sa.street || "";
  const cityLine = [sa.city, sa.state].filter(Boolean).join(", ");
  const pin = sa.pin || sa.zipCode || "";
  const phone = sa.phone || "";

  doc.setFont("helvetica", "bold");
  doc.text("Shipping To", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y += 14;
  doc.text(safe(name), marginX, y);
  y += 12;
  doc.text(safe(addressLine1), marginX, y);
  y += 12;
  doc.text(safe(cityLine), marginX, y);
  y += 12;
  doc.text(pin ? `PIN: ${safe(pin)}` : "", marginX, y);
  y += 12;
  doc.text(phone ? `Phone: ${safe(phone)}` : "", marginX, y);

  y += 14;

  // Items table
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map((it) => {
    const qty = Number(it.qty || 1);
    const unit = Number(it.price || 0);
    return [
      safe(it.name),
      safe(it.product || ""),
      String(qty),
      currency(unit),
      currency(qty * unit),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Item", "SKU", "Qty", "Unit Price", "Line Total"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6, valign: "middle" },
    headStyles: { fillColor: [17, 24, 39] }, // brand-dark
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const endY = doc.lastAutoTable?.finalY || y + 120;

  // Totals
  const subtotal = Number(order.subtotal ?? 0);
  const gst = Number(order.gst ?? 0);
  const shippingFee = Number(order.shippingFee ?? 0);
  const total = Number(order.total ?? subtotal + gst + shippingFee);

  const totalsX = 360;
  let ty = endY + 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const line = (label, value, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, totalsX, ty);
    doc.text(value, 555, ty, { align: "right" });
    ty += 14;
  };

  line("Subtotal", currency(subtotal));
  line("GST", currency(gst));
  line("Shipping", shippingFee === 0 ? "FREE" : currency(shippingFee));
  doc.setDrawColor(230);
  doc.line(totalsX, ty, 555, ty);
  ty += 12;
  line("Total", currency(total), true);

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("This is a computer-generated invoice.", marginX, 820);

  doc.save(`${invoiceNo}.pdf`);
}

