import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { useTelemetry } from "../hooks/useTelemetry.jsx";

const MESSAGES = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "No internet connection."
};

const field = "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-[14px] outline-none transition-[border-color,box-shadow] focus:border-s1 focus:ring-3 focus:ring-s1/15";

export default function LoginModal({ open, onClose }) {
  const { auth } = useTelemetry();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const emailRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    const t = setTimeout(() => emailRef.current?.focus(), 30);
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await auth.login(email.trim(), pass);
      setPass("");
      onClose();
    } catch (err) {
      setMsg({ error: true, text: MESSAGES[err.code] || err.message });
    } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!email.trim()) { setMsg({ error: true, text: "Type your email first, then press reset." }); return; }
    try { await auth.resetPassword(email.trim()); setMsg({ error: false, text: "Password reset email sent." }); }
    catch (err) { setMsg({ error: true, text: MESSAGES[err.code] || err.message }); }
  };

  return (
    <div className="fade-in fixed inset-0 z-[60] grid place-items-center bg-black/35 p-4 backdrop-blur-[2px]" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="login-title" className="pop-in relative w-full max-w-[380px] rounded-2xl border border-line bg-surface p-6 shadow-2xl shadow-black/20 sm:p-7">
        <button onClick={onClose} aria-label="Close" className="btn btn-quiet absolute right-3 top-3 size-8 px-0"><Icon name="close" /></button>
        <h2 id="login-title" className="text-[19px] font-semibold tracking-[-0.01em]">Operator sign in</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">Needed to switch modes and move the panel.</p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">Email</span>
            <input ref={emailRef} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className={field} />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-[13px] font-medium">
              Password
              <button type="button" onClick={reset} className="text-[12.5px] font-normal text-ink-2 underline-offset-2 hover:text-ink hover:underline">Forgot?</button>
            </span>
            <input type="password" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} required className={field} />
          </label>
          {msg && <p className={`fade-in text-[13px] ${msg.error ? "text-crit-ink" : "text-good-ink"}`} role="status">{msg.text}</p>}
          <button type="submit" disabled={busy || !email || !pass} className="btn btn-primary h-10 w-full">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-[12px] text-muted">Operator accounts are created by the admin in the Firebase console.</p>
      </div>
    </div>
  );
}
