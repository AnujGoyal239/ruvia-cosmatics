const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const safe = (v) => (v === undefined || v === null ? "" : String(v));

const formatDateTime = (dt) => {
  try {
    const d = dt ? new Date(dt) : new Date();
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const baseLayout = ({ title, preheader, bodyHtml }) => {
  const brand = process.env.EMAIL_BRAND_NAME || "Ruvia Cosmetics";
  const supportEmail = process.env.EMAIL_SUPPORT_EMAIL || process.env.EMAIL_FROM_EMAIL || "";

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${safe(title)}</title>
      <style>
        body { margin:0; background:#FDFBF7; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; color:#1f2937; }
        .wrap { max-width: 640px; margin: 0 auto; padding: 24px; }
        .card { background:#ffffff; border:1px solid rgba(31,41,55,0.08); border-radius: 16px; overflow:hidden; }
        .header { padding: 18px 20px; background:#3E2E2C; color:#fff; }
        .header h1 { margin:0; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; }
        .content { padding: 20px; }
        .muted { color: rgba(31,41,55,0.65); font-size: 13px; line-height: 1.55; }
        .h2 { margin: 0 0 8px 0; font-size: 20px; }
        .btn { display:inline-block; padding: 12px 16px; border-radius: 10px; background:#FF9A9E; color:#1f2937 !important; text-decoration:none; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; font-size: 11px; }
        .divider { height:1px; background: rgba(31,41,55,0.08); margin: 16px 0; }
        table { width:100%; border-collapse: collapse; }
        th, td { padding: 10px 0; border-bottom: 1px solid rgba(31,41,55,0.08); font-size: 13px; }
        th { text-align:left; color: rgba(31,41,55,0.65); font-weight: 700; }
        td:last-child, th:last-child { text-align:right; }
        .footer { padding: 16px 20px; font-size: 12px; color: rgba(31,41,55,0.6); }
      </style>
    </head>
    <body>
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
        ${safe(preheader)}
      </div>
      <div class="wrap">
        <div class="card">
          <div class="header">
            <h1>${safe(brand)}</h1>
          </div>
          <div class="content">
            ${bodyHtml}
          </div>
          <div class="footer">
            Need help? Reply to this email${supportEmail ? ` or contact <strong>${safe(supportEmail)}</strong>` : ""}.
            <div class="divider"></div>
            This is an automated message.
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
};

const welcomeEmail = ({ user }) => {
  const name = safe(user?.name || "there");
  const subject = `Welcome to Ruvia, ${name}!`;

  const html = baseLayout({
    title: "Welcome to Ruvia",
    preheader: "Your account is ready. Let’s get you glowing.",
    bodyHtml: `
      <h2 class="h2">Welcome, ${name}.</h2>
      <p class="muted">
        Your Ruvia account has been created successfully. You can now track orders, manage your address book, and write verified product reviews.
      </p>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/shop">Explore Products</a>
    `,
  });

  const text = `Welcome, ${name}.\n\nYour Ruvia account has been created successfully.\n\nExplore products: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/shop`;

  return { subject, text, html };
};

const orderConfirmationEmail = ({ user, order }) => {
  const name = safe(user?.name || "Customer");
  const orderId = safe(order?._id || "");
  const orderNo = orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "Your order";
  const placedAt = formatDateTime(order?.createdAt || Date.now());
  const items = Array.isArray(order?.items) ? order.items : [];

  const rows = items
    .map((it) => {
      const qty = Number(it?.qty || 1);
      const lineTotal = Number(it?.price || 0) * qty;
      return `<tr><td>${safe(it?.name)}</td><td>${qty}</td><td>${currency(lineTotal)}</td></tr>`;
    })
    .join("");

  const subtotal = Number(order?.subtotal ?? 0);
  const gst = Number(order?.gst ?? 0);
  const shippingFee = Number(order?.shippingFee ?? 0);
  const total = Number(order?.total ?? subtotal + gst + shippingFee);

  const sa = order?.shippingAddress || {};
  const addr1 = safe(sa.address || sa.street || "");
  const addr2 = [sa.city, sa.state].filter(Boolean).join(", ");
  const pin = safe(sa.pin || sa.zipCode || "");

  const subject = `Thanks for your order — ${orderNo}`;

  const html = baseLayout({
    title: "Order Confirmed",
    preheader: `Order confirmed • ${orderNo}`,
    bodyHtml: `
      <h2 class="h2">Order placed successfully.</h2>
      <p class="muted">Hi ${name}, thanks for shopping with us. We’ll notify you when your order is shipped.</p>
      <p class="muted"><strong>${orderNo}</strong> • Placed on ${safe(placedAt)}</p>
      <div class="divider"></div>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>${rows || ""}</tbody>
      </table>
      <div class="divider"></div>
      <table>
        <tbody>
          <tr><td>Subtotal</td><td>${currency(subtotal)}</td></tr>
          <tr><td>GST</td><td>${currency(gst)}</td></tr>
          <tr><td>Shipping</td><td>${shippingFee === 0 ? "FREE" : currency(shippingFee)}</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>${currency(total)}</strong></td></tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <p class="muted"><strong>Shipping to:</strong><br/>${addr1}${addr2 ? `<br/>${safe(addr2)}` : ""}${pin ? `<br/>${safe(pin)}` : ""}</p>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(order?._id)}">View order</a>
    `,
  });

  const text =
    `Hi ${name}, thanks for your order.\n` +
    `${orderNo} • Placed on ${placedAt}\n` +
    `Total: ${currency(total)}\n\n` +
    `View order: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(order?._id)}`;

  return { subject, text, html };
};

const orderStatusUpdateEmail = ({ user, order, status }) => {
  const name = safe(user?.name || "Customer");
  const orderId = safe(order?._id || "");
  const orderNo = orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "Your order";
  const when = formatDateTime(Date.now());
  const normalized = safe(status || order?.status || "Update");

  const subject = `${orderNo} • ${normalized}`;

  const html = baseLayout({
    title: "Order Update",
    preheader: `${orderNo} status update: ${normalized}`,
    bodyHtml: `
      <h2 class="h2">Your order update</h2>
      <p class="muted">Hi ${name}, your order status changed to <strong>${normalized}</strong>.</p>
      <p class="muted"><strong>${orderNo}</strong> • Updated at ${safe(when)}</p>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}">Track order</a>
    `,
  });

  const text =
    `Hi ${name}, your order status is now: ${normalized}\n` +
    `${orderNo} • Updated at ${when}\n\n` +
    `Track: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/orders/${safe(orderId)}`;

  return { subject, text, html };
};

const adminNewOrderEmail = ({ user, order }) => {
  const customerName = safe(user?.name || "Customer");
  const customerEmail = safe(user?.email || "");
  const orderId = safe(order?._id || "");
  const orderNo = orderId ? `ORD-${orderId.slice(-6).toUpperCase()}` : "New order";
  const placedAt = formatDateTime(order?.createdAt || Date.now());

  const items = Array.isArray(order?.items) ? order.items : [];
  const rows = items
    .map((it) => {
      const qty = Number(it?.qty || 1);
      const lineTotal = Number(it?.price || 0) * qty;
      return `<tr><td>${safe(it?.name)}</td><td>${qty}</td><td>${currency(lineTotal)}</td></tr>`;
    })
    .join("");

  const subtotal = Number(order?.subtotal ?? 0);
  const discount = Number(order?.discount ?? 0);
  const gst = Number(order?.gst ?? 0);
  const shippingFee = Number(order?.shippingFee ?? 0);
  const total = Number(order?.total ?? subtotal - discount + gst + shippingFee);

  const subject = `New order received — ${orderNo}`;

  const html = baseLayout({
    title: "New Order",
    preheader: `New order • ${orderNo}`,
    bodyHtml: `
      <h2 class="h2">New order received</h2>
      <p class="muted"><strong>${orderNo}</strong> • Placed on ${safe(placedAt)}</p>
      <p class="muted">Customer: <strong>${customerName}</strong>${customerEmail ? ` (${customerEmail})` : ""}</p>
      <div class="divider"></div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>${rows || ""}</tbody>
      </table>
      <div class="divider"></div>
      <table>
        <tbody>
          <tr><td>Subtotal</td><td>${currency(subtotal)}</td></tr>
          ${discount ? `<tr><td>Discount</td><td>- ${currency(discount)}</td></tr>` : ""}
          <tr><td>GST</td><td>${currency(gst)}</td></tr>
          <tr><td>Shipping</td><td>${shippingFee === 0 ? "FREE" : currency(shippingFee)}</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>${currency(total)}</strong></td></tr>
        </tbody>
      </table>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/orders">Open admin orders</a>
    `,
  });

  const text =
    `New order received\n` +
    `${orderNo} • Placed on ${placedAt}\n` +
    `Customer: ${customerName}${customerEmail ? ` (${customerEmail})` : ""}\n` +
    `Total: ${currency(total)}\n` +
    `Admin: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/orders`;

  return { subject, text, html };
};

const adminReturnRequestEmail = ({ user, order, returnRequest }) => {
  const customerName = safe(user?.name || "Customer");
  const customerEmail = safe(user?.email || "");
  const orderId = safe(order?._id || returnRequest?.order || "");
  const orderNo = orderId ? `ORD-${String(orderId).slice(-6).toUpperCase()}` : "Return request";
  const createdAt = formatDateTime(returnRequest?.createdAt || Date.now());
  const reason = safe(returnRequest?.reason || "");

  const subject = `Return request — ${orderNo}`;

  const html = baseLayout({
    title: "Return Request",
    preheader: `Return request • ${orderNo}`,
    bodyHtml: `
      <h2 class="h2">Return request submitted</h2>
      <p class="muted"><strong>${orderNo}</strong> • Submitted on ${safe(createdAt)}</p>
      <p class="muted">Customer: <strong>${customerName}</strong>${customerEmail ? ` (${customerEmail})` : ""}</p>
      <div class="divider"></div>
      <p class="muted"><strong>Reason:</strong><br/>${reason || "—"}</p>
      <div class="divider"></div>
      <a class="btn" href="${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/returns">Open admin returns</a>
    `,
  });

  const text =
    `Return request submitted\n` +
    `${orderNo} • Submitted on ${createdAt}\n` +
    `Customer: ${customerName}${customerEmail ? ` (${customerEmail})` : ""}\n` +
    `Reason: ${reason || "—"}\n` +
    `Admin: ${safe(process.env.FRONTEND_URL || "http://localhost:3000")}/admin/returns`;

  return { subject, text, html };
};

module.exports = {
  welcomeEmail,
  orderConfirmationEmail,
  orderStatusUpdateEmail,
  adminNewOrderEmail,
  adminReturnRequestEmail,
};

