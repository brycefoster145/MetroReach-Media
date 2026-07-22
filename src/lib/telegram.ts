const TELEGRAM_TOKEN = "8855576613:AAHJIBjBxEQ7r2O7uteEYG6c7NjyptXNpDs";
const CHAT_ID = "7977291523";

export async function sendTelegramMessage(text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
    }),
  });
}
