// Calendar reminders (an .ics file) for the sowing and harvest months of a plan. Each reminder covers a whole month,
// because the app works with months, not exact days. The file is made on the phone; nothing is sent anywhere.
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const first = (y, m) => new Date(Date.UTC(y, m, 1));

// iCalendar text escaping
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// lines longer than 75 bytes are folded; a fold never splits a UTF-8 character
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "", bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ""; bytes = 0; limit = 74; }
    cur += ch; bytes += b;
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

// The month of the first sowing: this year if it is still ahead (or now), else next year.
export function firstSowDate(month0, now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  return month0 >= m ? first(y, month0) : first(y + 1, month0);
}

// events: [{ kind: "sow" | "harvest", name, abs, span }] where abs counts months (the first sowing is the smallest abs)
// text: { sow, harvest, note, alarm, product } with {crop} and {field} places
export function buildIcs(events, { now = new Date(), field = "", text, calName }) {
  if (!events.length) return null;
  const base = Math.min(...events.map((e) => e.abs));
  const start = firstSowDate(((base % 12) + 12) % 12, now);
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EarthEcho//Plan reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`];
  events.forEach((e, i) => {
    const s = first(start.getUTCFullYear(), start.getUTCMonth() + (e.abs - base));
    const end = first(s.getUTCFullYear(), s.getUTCMonth() + e.span);
    const title = (e.kind === "sow" ? text.sow : text.harvest).split("{crop}").join(e.name).split("{field}").join(field);
    lines.push("BEGIN:VEVENT", `UID:earthecho-${ymd(s)}-${i}-${Math.abs(hash(title))}@earthecho`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(s)}`, `DTEND;VALUE=DATE:${ymd(end)}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(text.note)}`, "TRANSP:TRANSPARENT");
    if (e.kind === "sow") lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "TRIGGER:-P7D", "END:VALARM");
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

export function downloadIcs(content, filename) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
