/**
 * Notification Utility for HR & Payroll System
 * Supports Telegram Bot API and Email Alerts
 */

const TELEGRAM_BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "";
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

/**
 * Sends a notification to the configured Telegram Group
 */
export async function sendTelegramNotification(message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("Telegram notifications not configured. Set NEXT_PUBLIC_TELEGRAM_BOT_TOKEN and NEXT_PUBLIC_TELEGRAM_CHAT_ID.");
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML"
      }),
    });
    return await response.json();
  } catch (error) {
    console.error("Telegram Notification Error:", error);
  }
}

/**
 * Sends an email notification to the Admin
 * Note: For commercial use, integrated with an API like Resend or SendGrid.
 * Currently uses a fallback log or hypothetically calls a function.
 */
export async function sendEmailNotification(subject: string, body: string) {
  if (!ADMIN_EMAIL) {
    console.warn("Admin email not configured. Set NEXT_PUBLIC_ADMIN_EMAIL.");
    return;
  }

  console.log(`[Email Alert to ${ADMIN_EMAIL}] Subject: ${subject}\nBody: ${body}`);
  
  // Example integration with Resend (requires an API key and backend)
  // fetch('/api/send-email', { method: 'POST', body: JSON.stringify({ to: ADMIN_EMAIL, subject, body }) });

  // For now, we simulate the logic.
}

/**
 * Higher level function to notify of employee record changes
 */
export async function notifyRecordChange(employeeName: string, memberId: string, actionType: string, modifiedBy: string = "Admin") {
  const timestamp = new Date().toLocaleString();
  const message = `
🚨 <b>Registry Modification Alert</b>
------------------------------------
<b>Action:</b> ${actionType}
<b>Employee:</b> ${employeeName}
<b>Member ID:</b> ${memberId}
<b>Modified By:</b> ${modifiedBy}
<b>Timestamp:</b> ${timestamp}
------------------------------------
<i>Proprietary GSOFT Security Layer</i>
  `.trim();

  // 1. Send to Telegram
  await sendTelegramNotification(message);

  // 2. Send Email
  await sendEmailNotification(
    `Security Alert: Registry Change - ${employeeName}`,
    `An employee record was modified.\nAction: ${actionType}\nEmployee: ${employeeName}\nID: ${memberId}\nTime: ${timestamp}`
  );
}
