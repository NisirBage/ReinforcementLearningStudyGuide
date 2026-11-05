import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { formatClock } from "../domain/clock";
import { useProgress } from "../store/ProgressContext";
import { RouteBoundary } from "./Boundary";

/** [path, label, icon, on the phone's bottom bar]. Items not on the bar are under "More" on phones; the desktop sidebar shows all. */
export const NAV = [
  ["/", "Home", "⌂", true],
  ["/learn", "Learn", "☰", true],
  ["/practice", "Practice", "✎", true],
  ["/exam", "Mock exams", "⏱", true],
  ["/revision", "Revise", "↻", true],
  ["/search", "Search", "⌕", false],
  ["/progress", "Progress", "◔", false],
  ["/settings", "Settings", "⚙", false],
] as const;

/** Shown on every other page while a mock exam is running, so leaving the exam page never hides the clock. */
function ExamBanner({ deadline }: { deadline: number }) {
  const { now } = useProgress();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const left = deadline - now();
  return (
    <div className="banner exam-banner" role="status">
      {left > 0 ? (
        <>
          A mock exam is in progress: <strong>{formatClock(left)}</strong> left. The clock keeps running. <Link to="/exam">Return to the exam</Link>
        </>
      ) : (
        <>
          Time is up on your mock exam. <Link to="/exam">Open it to see your results</Link>
        </>
      )}
    </div>
  );
}

export function Layout() {
  const { ready, message, saveFailed, data, examDeadline } = useProgress();
  const [more, setMore] = useState(false);
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
    setMore(false);
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
        {NAV.map(([to, label, icon, bar]) => (
          <NavLink key={to} to={to} end={to === "/"} className={bar ? undefined : "nav-secondary"}>
            <span aria-hidden="true">{icon}</span>
            {label}
          </NavLink>
        ))}
        <button type="button" className="nav-more" aria-expanded={more} aria-controls="more-menu" onClick={() => setMore((m) => !m)}>
          <span aria-hidden="true">⋯</span>
          More
        </button>
      </nav>
      {more && (
        <div id="more-menu" className="more-menu">
          {NAV.filter(([, , , bar]) => !bar).map(([to, label, icon]) => (
            <Link key={to} to={to}>
              <span aria-hidden="true">{icon}</span> {label}
            </Link>
          ))}
        </div>
      )}
      <main id="main" tabIndex={-1}>
        {message && (
          <div className="banner" role="status">
            {message}
          </div>
        )}
        {examDeadline !== null && !loc.pathname.startsWith("/exam") && <ExamBanner deadline={examDeadline} />}
        {saveFailed && (
          <div className="banner warn" role="alert">
            Progress could not be saved in this browser. Export a backup from the Progress page to keep it.
          </div>
        )}
        {ready ? (
          <RouteBoundary resetKey={loc.pathname + loc.search}>
            <Outlet />
          </RouteBoundary>
        ) : (
          <p className="muted" role="status">
            Loading your progress…
          </p>
        )}
      </main>
    </div>
  );
}
