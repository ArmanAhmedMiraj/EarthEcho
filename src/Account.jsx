import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { loadFields } from "./fields.js";
import {
  register, verifyCode, resendCode, logIn, logOut, syncNow, checkForm, validPhone, errorKey,
  getStatus, subscribe, setFlash, takeFlash,
} from "./account.js";
import "./account.css";

const fill = (s, vars) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s || "");

// ---------------------------------------------------------------- the register / log in / code forms
export function AuthPanel({ t, initialTab = "login", onBack }) {
  const [tab, setTab] = useState(initialTab); // login | register | verify
  const [vals, setVals] = useState({ first: "", middle: "", last: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [cool, setCool] = useState(0);
  const formRef = useRef(null);

  useEffect(() => {
    if (cool <= 0) return undefined;
    const id = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cool]);

  const set = (k) => (e) => { setVals((v) => ({ ...v, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: "" })); setMessage(""); };

  // signed in or verified: save this device's farms to the account, then start the app again with them loaded
  const finish = async () => {
    const before = loadFields().length;
    const r = await syncNow();
    if (r.ok && before > 0) setFlash("merged", { n: before });
    else setFlash("welcome", {});
    window.location.reload();
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    const found = checkForm(vals);
    setErrors(found);
    if (Object.keys(found).length) { setMessage(""); setTimeout(() => { const el = formRef.current && formRef.current.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }, 0); return; }
    setBusy(true); setMessage("");
    const r = await register(vals);
    setBusy(false);
    if (r.ok) { await finish(); return; }
    if (r.error === "invalid" && r.fields) {
      const map = { first: "acErrFirst", middle: "acErrMiddle", last: "acErrLast", email: "acErrEmail", phone: "acErrPhone", password: "acErrPassword", confirm: "acErrConfirm" };
      setErrors(Object.fromEntries(Object.keys(r.fields).map((k) => [k, map[k]])));
      return;
    }
    setMessage(t[errorKey(r)]);
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    const found = {};
    if (!validPhone(vals.phone)) found.phone = "acErrPhone";
    if (!vals.password) found.password = "acErrPassword";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true); setMessage("");
    const r = await logIn(vals.phone, vals.password);
    if (r.ok) { await finish(); return; }
    setBusy(false);
    if (r.error === "unverified" && r.step === "verify") { setDevCode(r.devCode || ""); setCode(""); setCool(60); setTab("verify"); return; }
    setMessage(r.error === "wait" ? t.acErrWait : fill(t[errorKey(r)], { n: r.triesLeft }));
  };

  const submitCode = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setMessage(t.acErrCodeShape); return; }
    setBusy(true); setMessage("");
    const r = await verifyCode(vals.phone, code.trim());
    if (r.ok) { await finish(); return; }
    setBusy(false);
    setMessage(fill(t[errorKey(r)], { n: r.triesLeft == null ? "" : r.triesLeft }));
  };

  const again = async () => {
    if (cool > 0) return;
    setBusy(true); setMessage("");
    const r = await resendCode(vals.phone);
    setBusy(false);
    if (r.ok) { setDevCode(r.devCode || ""); setCool(60); return; }
    setMessage(t[errorKey(r)]);
  };

  const field = (key, label, props = {}, hint) => (
    <label className="ac-field">
      <span>{label}</span>
      <input
        value={vals[key]}
        onChange={set(key)}
        aria-invalid={errors[key] ? "true" : undefined}
        {...props}
      />
      {hint && !errors[key] && <span className="ac-hint">{hint}</span>}
      {errors[key] && <span className="ac-err" role="alert">{t[errors[key]]}</span>}
    </label>
  );

  const pwField = (key, label, autoComplete, hint) => (
    <label className="ac-field">
      <span>{label}</span>
      <span className="ac-pw">
        <input
          type={showPw ? "text" : "password"}
          value={vals[key]}
          onChange={set(key)}
          autoComplete={autoComplete}
          aria-invalid={errors[key] ? "true" : undefined}
        />
        <button type="button" className="ac-link" onClick={() => setShowPw((s) => !s)}>{showPw ? t.acHide : t.acShow}</button>
      </span>
      {hint && !errors[key] && <span className="ac-hint">{hint}</span>}
      {errors[key] && <span className="ac-err" role="alert">{t[errors[key]]}</span>}
    </label>
  );

  return (
    <div className="ac-card ac-auth">
      {onBack && <button type="button" className="ac-link ac-back" onClick={onBack}>← {t.acBack}</button>}
      {tab !== "verify" && (
        <div className="ac-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "login"} className={tab === "login" ? "on" : ""} onClick={() => { setTab("login"); setErrors({}); setMessage(""); }}>{t.acTabLogin}</button>
          <button role="tab" aria-selected={tab === "register"} className={tab === "register" ? "on" : ""} onClick={() => { setTab("register"); setErrors({}); setMessage(""); }}>{t.acTabRegister}</button>
        </div>
      )}

      {tab === "login" && (
        <form onSubmit={submitLogin} noValidate>
          {field("phone", t.acPhone, { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "01XXXXXXXXX" })}
          {pwField("password", t.acPassword, "current-password")}
          {message && <p className="ac-msg" role="alert">{message}</p>}
          <button className="btn wide" disabled={busy}>{busy ? t.acWorking : t.acLoginBtn}</button>
          <p className="ac-switch">{t.acNoAccount} <button type="button" className="ac-link" onClick={() => { setTab("register"); setErrors({}); setMessage(""); }}>{t.acTabRegister}</button></p>
        </form>
      )}

      {tab === "register" && (
        <form onSubmit={submitRegister} noValidate ref={formRef}>
          <div className="ac-two">
            {field("first", `${t.acFirst} *`, { autoComplete: "given-name", maxLength: 60 })}
            {field("middle", t.acMiddle, { autoComplete: "additional-name", maxLength: 60 })}
          </div>
          {field("last", `${t.acLast} *`, { autoComplete: "family-name", maxLength: 60 })}
          {field("email", t.acEmail, { type: "email", inputMode: "email", autoComplete: "email", maxLength: 120 })}
          {field("phone", `${t.acPhone} *`, { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "01XXXXXXXXX" }, t.acPhoneHint)}
          {pwField("password", `${t.acPassword} *`, "new-password", t.acPasswordHint)}
          {pwField("confirm", `${t.acConfirm} *`, "new-password")}
          {message && <p className="ac-msg" role="alert">{message}</p>}
          <button className="btn wide" disabled={busy}>{busy ? t.acWorking : t.acRegisterBtn}</button>
          <p className="ac-switch">{t.acHaveAccount} <button type="button" className="ac-link" onClick={() => { setTab("login"); setErrors({}); setMessage(""); }}>{t.acTabLogin}</button></p>
        </form>
      )}

      {tab === "verify" && (
        <form onSubmit={submitCode} noValidate>
          <h3>{t.acVerifyTitle}</h3>
          <p>{fill(t.acVerifyBody, { phone: vals.phone })}</p>
          <label className="ac-field">
            <span>{t.acCode}</span>
            <input
              className="ac-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setMessage(""); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
            />
          </label>
          {devCode && <p className="ac-dev">{fill(t.acDevCode, { code: devCode })}</p>}
          {message && <p className="ac-msg" role="alert">{message}</p>}
          <button className="btn wide" disabled={busy}>{busy ? t.acWorking : t.acVerifyBtn}</button>
          <p className="ac-switch">
            <button type="button" className="ac-link" disabled={cool > 0 || busy} onClick={again}>{cool > 0 ? fill(t.acResendIn, { s: cool }) : t.acResend}</button>
            {" · "}
            <button type="button" className="ac-link" onClick={() => { setTab("register"); setMessage(""); }}>{t.acChangeNumber}</button>
          </p>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the first page: guest or account
export function Landing({ t, onGuest }) {
  const [auth, setAuth] = useState(false);
  const arrow = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  const person = <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /></svg>;
  return (
    <main className="orb-land">
      {auth ? (
        <div className="orb-auth ac-card"><AuthPanel t={t} initialTab="login" onBack={() => setAuth(false)} /></div>
      ) : (
        <div className="orb-hero">
          <div className="orb-copy">
            <p className="orb-badge"><i />{t.orbBadge}</p>
            <h1>{t.orbH1a}<br />{t.orbH1b}</h1>
            <p className="orb-lead">{t.orbLead}</p>
            <div className="orb-cta">
              <button type="button" className="orb-go gold" onClick={onGuest}><b>{t.orbGuest}{arrow}</b><span>{t.orbGuestSub}</span></button>
              <button type="button" className="orb-go glass" onClick={() => setAuth(true)}><b>{t.orbUser}{person}</b><span>{t.orbUserSub}</span></button>
            </div>
            <p className="orb-note">{t.orbNote}</p>
          </div>
          <div className="orb-vis" aria-hidden="true">
            <div className="orb-globe"><div className="orb-land-blobs" /></div>
            <svg className="orb-orbit" viewBox="0 0 640 540">
              <ellipse cx="440" cy="170" rx="240" ry="74" fill="none" stroke="rgba(246,207,106,0.55)" strokeWidth="1.4" strokeDasharray="3 7" transform="rotate(-18 440 170)" />
              <g>
                <animateMotion dur="14s" repeatCount="indefinite" path="M 208 243 A 240 74 -18 1 1 664 97 A 240 74 -18 1 1 208 243" />
                <rect x="-11" y="-5" width="22" height="10" rx="2" fill="#f6cf6a" /><rect x="-26" y="-3" width="12" height="6" fill="#7fb2ff" /><rect x="14" y="-3" width="12" height="6" fill="#7fb2ff" />
              </g>
              <line x1="320" y1="290" x2="206" y2="384" stroke="#3ddbc0" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
            </svg>
            <div className="orb-plot">
              <svg viewBox="-170 -120 340 250" style={{ width: "100%", height: "auto", display: "block" }}>
                <polygon points="-150,0 0,75 0,125 -150,50" fill="#6b4a2f" /><polygon points="-150,0 0,75 0,92 -150,17" fill="#3f7d4c" /><polygon points="-150,34 0,109 0,125 -150,50" fill="#4a3220" />
                <polygon points="0,75 150,0 150,50 0,125" fill="#553a25" /><polygon points="0,75 150,0 150,17 0,92" fill="#2f6a3e" /><polygon points="0,109 150,34 150,50 0,125" fill="#3a2718" />
                <polygon points="0,-75 150,0 0,75 -150,0" fill="#5fcf7c" />
                <g stroke="#2f8f52" strokeWidth="5" strokeLinecap="round"><line x1="-112" y1="-6" x2="14" y2="57" /><line x1="-84" y1="-20" x2="42" y2="43" /><line x1="-56" y1="-34" x2="70" y2="29" /><line x1="-28" y1="-48" x2="98" y2="15" /><line x1="0" y1="-62" x2="126" y2="1" /></g>
                <polygon points="-40,-25 20,5 60,-15 0,-45" fill="rgba(127,178,255,0.75)" />
                <g className="orb-scan"><line x1="-75" y1="-37.5" x2="75" y2="37.5" stroke="#f6cf6a" strokeWidth="3" strokeLinecap="round" /></g>
                <polygon points="0,-75 150,0 0,75 -150,0" fill="none" stroke="rgba(246,207,106,0.9)" strokeWidth="1.5" strokeDasharray="6 6" />
              </svg>
            </div>
            <div className="orb-chip c1"><b>{t.orbChipSoil}</b>{t.orbChipSoilV}</div>
            <div className="orb-chip c2"><b>{t.orbChipRain}</b>{t.orbChipRainV}</div>
            <div className="orb-chip c3"><b>{t.orbChipWater}</b>{t.orbChipWaterV}</div>
          </div>
        </div>
      )}
      <div className="orb-groups">
        <div><strong>{t.orbGToday}</strong><span>{t.orbGTodayT}</span></div>
        <div><strong>{t.orbGPlan}</strong><span>{t.orbGPlanT}</span></div>
        <div><strong>{t.orbGLand}</strong><span>{t.orbGLandT}</span></div>
        <div><strong>{t.orbGHelp}</strong><span>{t.orbGHelpT}</span></div>
      </div>
      <p className="orb-src">{t.orbSources}</p>
    </main>
  );
}

// ---------------------------------------------------------------- a window over the page (used from the top bar and the reminders)
export function AuthModal({ t, onClose, initialTab }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="ac-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ac-modal">
        <button className="ac-x" onClick={onClose} aria-label={t.acClose}>×</button>
        <AuthPanel t={t} initialTab={initialTab || "login"} />
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- top bar: log in button, or the signed-in person
export function AccountControl({ t, user, onLogin }) {
  const status = useSyncExternalStore(subscribe, getStatus);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // null | "ask" | "unsaved" | "offline"
  const [busy, setBusy] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  if (!user) return <button className="btn ac-login" onClick={onLogin}>{t.acLogin}</button>;

  const statusText = { ok: t.acSynced, syncing: t.acSyncing, offline: t.acOffline, error: t.acSyncErr, idle: t.acSynced }[status.state];
  const go = async (force) => {
    setBusy(true);
    const r = await logOut({ force });
    if (r.ok) { window.location.reload(); return; }
    setBusy(false);
    setConfirm(r.error === "network" ? "offline" : "unsaved");
  };

  return (
    <div className="ac-menu" ref={box}>
      <button className="btn ac-user" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`ac-dot ${status.state}`} aria-hidden="true" /> {user.first}
      </button>
      {open && (
        <div className="ac-pop" role="menu">
          <p className="ac-name">{fill(t.acHello, { name: `${user.first} ${user.last}` })}</p>
          <p className="small muted">{user.phone}</p>
          <p className="small">{statusText}</p>
          <button className="ac-sec" onClick={() => setConfirm("ask")}>{t.acLogout}</button>
        </div>
      )}
      {confirm && createPortal(
        <div className="ac-overlay" role="dialog" aria-modal="true">
          <div className="ac-modal small">
            <h3>{t.acLogoutTitle}</h3>
            <p>{confirm === "offline" ? t.acLogoutNeedNet : confirm === "unsaved" ? t.acLogoutUnsaved : t.acLogoutBody}</p>
            <div className="ac-actions">
              <button className="ac-sec" onClick={() => setConfirm(null)}>{t.acCancel}</button>
              {confirm !== "offline" && <button className="btn" disabled={busy} onClick={() => go(confirm === "unsaved")}>{confirm === "unsaved" ? t.acLogoutAnyway : t.acLogout}</button>}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ---------------------------------------------------------------- guest notices
export function GuestBar({ t, onLogin }) {
  return (
    <div className="ac-guestbar" role="note">
      <span className="ac-badge">{t.acGuestBadge}</span>
      <span>{t.acGuestBar}</span>
      <button className="ac-link" onClick={onLogin}>{t.acGuestBarBtn}</button>
    </div>
  );
}

export function GuestReminder({ t, kind, onLogin, onClose }) {
  const yes = useRef(null);
  useEffect(() => {
    if (yes.current) yes.current.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="ac-overlay" role="dialog" aria-modal="true" aria-labelledby="ac-remind-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ac-modal small">
        <h3 id="ac-remind-title">{kind === "farm" ? t.acRemindFarmTitle : t.acRemindVisitTitle}</h3>
        {kind === "farm" ? (
          <>
            <ul className="ac-list">
              <li>{t.acRemindFarm1}</li>
              <li>{t.acRemindFarm2}</li>
              <li>{t.acRemindFarm3}</li>
            </ul>
            <p className="small muted">{t.acRemindFarmEnd}</p>
          </>
        ) : (
          <p>{t.acRemindVisit}</p>
        )}
        <div className="ac-actions">
          <button className="ac-sec" onClick={onClose}>{t.acRemindGuest}</button>
          <button className="btn" ref={yes} onClick={onLogin}>{t.acRemindLogin}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// a message that is shown once after logging in
export function Flash({ t }) {
  const [flash, setFlash_] = useState(() => takeFlash());
  if (!flash) return null;
  const text = flash.kind === "merged" ? fill(t.acFlashMerged, { n: flash.n }) : flash.kind === "expired" ? t.acFlashExpired : t.acFlashWelcome;
  return (
    <div className="ac-flash" role="status">
      <span>{text}</span>
      <button className="ac-x2" onClick={() => setFlash_(null)} aria-label={t.acClose}>×</button>
    </div>
  );
}
