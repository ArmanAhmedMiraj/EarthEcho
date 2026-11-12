// Sends the one-time code to a phone. Choose the sender with SMS_PROVIDER:
//   twilio     needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (a Twilio number or sender name)
//   bulksmsbd  needs BULKSMSBD_API_KEY and BULKSMSBD_SENDER_ID (a Bangladesh SMS gateway)
//   dev        (only with AUTH_DEV_OTP=1) sends nothing; the code is shown on screen. For testing on your own computer.
// Never put any of these values in the code.

export const smsReady = () => {
  const p = process.env.SMS_PROVIDER;
  if (p === "twilio") return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  if (p === "bulksmsbd") return Boolean(process.env.BULKSMSBD_API_KEY && process.env.BULKSMSBD_SENDER_ID);
  return process.env.AUTH_DEV_OTP === "1";
};

export const devMode = () => process.env.AUTH_DEV_OTP === "1" && !["twilio", "bulksmsbd"].includes(process.env.SMS_PROVIDER || "");

export async function sendSms(phone, text) {
  const p = process.env.SMS_PROVIDER;
  if (p === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: process.env.TWILIO_FROM, Body: text }),
    });
    if (!res.ok) throw new Error(`sms ${res.status}`);
    return true;
  }
  if (p === "bulksmsbd") {
    const url = new URL("https://bulksmsbd.net/api/smsapi");
    url.searchParams.set("api_key", process.env.BULKSMSBD_API_KEY);
    url.searchParams.set("type", "text");
    url.searchParams.set("number", phone.replace(/^\+/, ""));
    url.searchParams.set("senderid", process.env.BULKSMSBD_SENDER_ID);
    url.searchParams.set("message", text);
    const res = await fetch(url);
    const body = await res.text();
    let code = null;
    try { code = JSON.parse(body).response_code; } catch { /* not JSON */ }
    if (!res.ok || (code != null && Number(code) !== 202)) throw new Error("sms failed");
    return true;
  }
  if (devMode()) return true;
  throw new Error("no sms provider");
}
