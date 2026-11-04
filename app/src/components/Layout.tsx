import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useProgress } from "../store/ProgressContext";

export const NAV = [
  ["/", "Home", "⌂"],
  ["/learn", "Learn", "☰"],
  ["/search", "Search", "⌕"],
  ["/revision", "Revise", "↻"],
  ["/progress", "Progress", "◔"],
  ["/settings", "Settings", "⚙"],
] as const;

export function Layout() {
  const { ready, message, saveFailed, data } = useProgress();
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const loc = useLocation();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const t = data.settings.theme;
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }, [data.settings.theme]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    addEventListener("online", on);
    addEventListener("offline", off);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [loc.pathname]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="shell">
      <a className="skip" href="#main" onClick={(e) => (e.preventDefault(), document.getElementById("main")?.focus())}>
        Skip to content
      </a>
      <header className="topbar">
        <NavLink to="/" className="brand">
          RL Study Lab
        </NavLink>
        <form className="topsearch" role="search" onSubmit={submit}>
          <label htmlFor="topsearch" className="sr-only">
            Search the textbook
          </label>
          <input id="topsearch" type="search" placeholder="Search concepts, equations, sections…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {!online && <span className="pill">Offline</span>}
      </header>
      <nav className="nav" aria-label="Main">
        {NAV.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <span aria-hidden="true">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
      <main id="main" tabIndex={-1}>
        {message && (
          <div className="banner" role="status">
            {message}
          </div>
        )}
        {saveFailed && (
          <div className="banner warn" role="alert">
            Progress could not be saved in this browser. Export a backup from the Progress page to keep it.
          </div>
        )}
        {ready ? <Outlet /> : <p className="muted">Loading your progress…</p>}
      </main>
    </div>
  );
}
