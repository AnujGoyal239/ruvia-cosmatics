const getAdminNotificationRecipients = () => {
  const raw = String(process.env.ADMIN_NOTIFICATIONS_EMAIL || '').trim();
  if (!raw) return [];
  // Support comma-separated list
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

module.exports = { getAdminNotificationRecipients };

