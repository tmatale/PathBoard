import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import { isSunUp } from "./sun";

/**
 * PATH commute board — portrait kiosk.
 * Board fills the screen; tap the station title to open a slide-up
 * route-spine picker. A "home" station (default WTC) can be set
 * from the picker, and a quick-return chip jumps back to it.
 *
 * Data: Port Authority RidePATH feed (public, no auth):
 *   https://www.panynj.gov/bin/portauthority/ridepath.json
 *
 * Data source: API_URL points at the SAME-ORIGIN CloudFront proxy path.
 * Same-origin means no CORS. The leading slash keeps it rooted at the
 * domain, so it works regardless of the page being served from the /path/
 * subfolder. If the proxy is ever unreachable, this falls back to embedded
 * sample data and flags it.
 */


const API_URL = "/bin/portauthority/ridepath.json";
const REFRESH_MS = 30000;
const DEFAULT_HOME = "WTC";

type ThemeMode = "auto" | "light" | "dark";

function loadThemeMode(): ThemeMode {
  const v = localStorage.getItem("themeMode");
  return (v === "light" || v === "dark" || v === "auto") ? v : "auto";
}

function resolveTheme(mode: ThemeMode, coords: GeolocationCoordinates | null): "light" | "dark" {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (coords) return isSunUp(coords.latitude, coords.longitude) ? "light" : "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// Line colours (feed hex, no #).
const RED = "D93A30";    // NWK–WTC
const YEL = "FF9900";    // JSQ–33 St
const BLU = "4D92FB";    // HOB–33 St
const GRN = "65C100";    // HOB–WTC
const LINE_INFO = { [RED]: "NWK–WTC", [YEL]: "JSQ–33 St", [BLU]: "HOB–33 St", [GRN]: "HOB–WTC" };

const STATIONS = [
  { code: "NWK", name: "Newark",          region: "NJ", lines: [RED] },
  { code: "HAR", name: "Harrison",        region: "NJ", lines: [RED] },
  { code: "JSQ", name: "Journal Square",  region: "NJ", lines: [RED, YEL] },
  { code: "GRV", name: "Grove Street",    region: "NJ", lines: [RED, YEL] },
  { code: "NEW", name: "Newport",         region: "NJ", lines: [GRN, YEL] },
  { code: "EXP", name: "Exchange Place",  region: "NJ", lines: [RED, GRN] },
  { code: "HOB", name: "Hoboken",         region: "NJ", lines: [GRN, BLU] },
  { code: "WTC", name: "World Trade Ctr", region: "NY", lines: [RED, GRN] },
  { code: "CHR", name: "Christopher St",  region: "NY", lines: [YEL, BLU] },
  { code: "09S", name: "9th Street",      region: "NY", lines: [YEL, BLU] },
  { code: "14S", name: "14th Street",     region: "NY", lines: [YEL, BLU] },
  { code: "23S", name: "23rd Street",     region: "NY", lines: [YEL, BLU] },
  { code: "33S", name: "33rd Street",     region: "NY", lines: [YEL, BLU] },
];
const BY_CODE = Object.fromEntries(STATIONS.map((s) => [s.code, s]));

const DIR = [
  { key: "ToNY", label: "To New York", arrow: "→" },
  { key: "ToNJ", label: "To New Jersey", arrow: "←" },
];

// Embedded fallback so the board renders even if the live fetch is blocked.
const SAMPLE = {"results":[{"consideredStation":"NWK","destinations":[{"label":"ToNY","messages":[{"target":"WTC","secondsToArrival":"265","arrivalTimeMessage":"5 min","lineColor":"D93A30","headSign":"World Trade Center"},{"target":"WTC","secondsToArrival":"1465","arrivalTimeMessage":"25 min","lineColor":"D93A30","headSign":"World Trade Center"}]}]},{"consideredStation":"HAR","destinations":[{"label":"ToNJ","messages":[{"target":"NWK","secondsToArrival":"233","arrivalTimeMessage":"4 min","lineColor":"D93A30","headSign":"Newark"},{"target":"NWK","secondsToArrival":"1427","arrivalTimeMessage":"24 min","lineColor":"D93A30","headSign":"Newark"}]},{"label":"ToNY","messages":[{"target":"WTC","secondsToArrival":"367","arrivalTimeMessage":"6 min","lineColor":"D93A30","headSign":"World Trade Center"},{"target":"WTC","secondsToArrival":"1567","arrivalTimeMessage":"26 min","lineColor":"D93A30","headSign":"World Trade Center"}]}]},{"consideredStation":"JSQ","destinations":[{"label":"ToNJ","messages":[{"target":"NWK","secondsToArrival":"782","arrivalTimeMessage":"13 min","lineColor":"D93A30","headSign":"Newark"},{"target":"NWK","secondsToArrival":"1982","arrivalTimeMessage":"33 min","lineColor":"D93A30","headSign":"Newark"}]},{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"35","arrivalTimeMessage":"1 min","lineColor":"FF9900","headSign":"33rd Street"},{"target":"33S","secondsToArrival":"635","arrivalTimeMessage":"11 min","lineColor":"FF9900","headSign":"33rd Street"},{"target":"WTC","secondsToArrival":"1037","arrivalTimeMessage":"17 min","lineColor":"D93A30","headSign":"World Trade Center"}]}]},{"consideredStation":"GRV","destinations":[{"label":"ToNJ","messages":[{"target":"JSQ","secondsToArrival":"354","arrivalTimeMessage":"6 min","lineColor":"FF9900","headSign":"Journal Square"},{"target":"NWK","secondsToArrival":"487","arrivalTimeMessage":"8 min","lineColor":"D93A30","headSign":"Newark"}]},{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"257","arrivalTimeMessage":"4 min","lineColor":"FF9900","headSign":"33rd Street"},{"target":"33S","secondsToArrival":"857","arrivalTimeMessage":"14 min","lineColor":"FF9900","headSign":"33rd Street"}]}]},{"consideredStation":"NEW","destinations":[{"label":"ToNJ","messages":[{"target":"JSQ","secondsToArrival":"124","arrivalTimeMessage":"2 min","lineColor":"FF9900","headSign":"Journal Square"}]},{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"472","arrivalTimeMessage":"8 min","lineColor":"FF9900","headSign":"33rd Street"},{"target":"WTC","secondsToArrival":"712","arrivalTimeMessage":"12 min","lineColor":"65C100","headSign":"World Trade Center"},{"target":"33S","secondsToArrival":"1072","arrivalTimeMessage":"18 min","lineColor":"FF9900","headSign":"33rd Street"}]}]},{"consideredStation":"EXP","destinations":[{"label":"ToNJ","messages":[{"target":"NWK","secondsToArrival":"307","arrivalTimeMessage":"5 min","lineColor":"D93A30","headSign":"Newark"},{"target":"HOB","secondsToArrival":"967","arrivalTimeMessage":"16 min","lineColor":"65C100","headSign":"Hoboken"}]},{"label":"ToNY","messages":[{"target":"WTC","secondsToArrival":"135","arrivalTimeMessage":"2 min","lineColor":"D93A30","headSign":"World Trade Center"},{"target":"WTC","secondsToArrival":"912","arrivalTimeMessage":"15 min","lineColor":"65C100","headSign":"World Trade Center"}]}]},{"consideredStation":"WTC","destinations":[{"label":"ToNJ","messages":[{"target":"NWK","secondsToArrival":"70","arrivalTimeMessage":"1 min","lineColor":"D93A30","headSign":"Newark"},{"target":"HOB","secondsToArrival":"730","arrivalTimeMessage":"12 min","lineColor":"65C100","headSign":"Hoboken"},{"target":"NWK","secondsToArrival":"1270","arrivalTimeMessage":"21 min","lineColor":"D93A30","headSign":"Newark"}]}]},{"consideredStation":"HOB","destinations":[{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"110","arrivalTimeMessage":"2 min","lineColor":"4D92FB","headSign":"33rd Street"},{"target":"WTC","secondsToArrival":"530","arrivalTimeMessage":"9 min","lineColor":"65C100","headSign":"World Trade Center"},{"target":"33S","secondsToArrival":"710","arrivalTimeMessage":"12 min","lineColor":"4D92FB","headSign":"33rd Street"},{"target":"WTC","secondsToArrival":"1730","arrivalTimeMessage":"29 min","lineColor":"65C100","headSign":"World Trade Center"}]}]},{"consideredStation":"CHR","destinations":[{"label":"ToNJ","messages":[{"target":"JSQ","secondsToArrival":"356","arrivalTimeMessage":"6 min","lineColor":"FF9900","headSign":"Journal Square"},{"target":"HOB","secondsToArrival":"442","arrivalTimeMessage":"8 min","lineColor":"4D92FB","headSign":"Hoboken"}]},{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"350","arrivalTimeMessage":"6 min","lineColor":"FF9900","headSign":"33rd Street"},{"target":"33S","secondsToArrival":"572","arrivalTimeMessage":"10 min","lineColor":"4D92FB","headSign":"33rd Street"}]}]},{"consideredStation":"09S","destinations":[{"label":"ToNJ","messages":[{"target":"JSQ","secondsToArrival":"221","arrivalTimeMessage":"4 min","lineColor":"FF9900","headSign":"Journal Square"},{"target":"HOB","secondsToArrival":"307","arrivalTimeMessage":"5 min","lineColor":"4D92FB","headSign":"Hoboken"}]},{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"63","arrivalTimeMessage":"1 min","lineColor":"4D92FB","headSign":"33rd Street"},{"target":"33S","secondsToArrival":"450","arrivalTimeMessage":"8 min","lineColor":"FF9900","headSign":"33rd Street"}]}]},{"consideredStation":"14S","destinations":[{"label":"ToNJ","messages":[{"target":"JSQ","secondsToArrival":"126","arrivalTimeMessage":"2 min","lineColor":"FF9900","headSign":"Journal Square"},{"target":"HOB","secondsToArrival":"212","arrivalTimeMessage":"4 min","lineColor":"4D92FB","headSign":"Hoboken"}]},{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"133","arrivalTimeMessage":"2 min","lineColor":"4D92FB","headSign":"33rd Street"},{"target":"33S","secondsToArrival":"520","arrivalTimeMessage":"9 min","lineColor":"FF9900","headSign":"33rd Street"}]}]},{"consideredStation":"23S","destinations":[{"label":"ToNJ","messages":[{"target":"JSQ","secondsToArrival":"46","arrivalTimeMessage":"1 min","lineColor":"FF9900","headSign":"Journal Square"},{"target":"HOB","secondsToArrival":"132","arrivalTimeMessage":"2 min","lineColor":"4D92FB","headSign":"Hoboken"}]},{"label":"ToNY","messages":[{"target":"33S","secondsToArrival":"0","arrivalTimeMessage":"0 min","lineColor":"FF9900","headSign":"33rd Street"},{"target":"33S","secondsToArrival":"208","arrivalTimeMessage":"4 min","lineColor":"4D92FB","headSign":"33rd Street"}]}]},{"consideredStation":"33S","destinations":[{"label":"ToNJ","messages":[{"target":"HOB","secondsToArrival":"100","arrivalTimeMessage":"2 min","lineColor":"4D92FB","headSign":"Hoboken"},{"target":"JSQ","secondsToArrival":"520","arrivalTimeMessage":"9 min","lineColor":"FF9900","headSign":"Journal Square"},{"target":"HOB","secondsToArrival":"700","arrivalTimeMessage":"12 min","lineColor":"4D92FB","headSign":"Hoboken"}]}]}]};


// Live arrival display, in whole minutes.
// `anchorMs` is when the current feed was received; secondsToArrival is
// relative to that, so the absolute arrival instant is
// anchorMs + secondsToArrival*1000. We recompute the remaining minutes
// against `nowMs` on each tick, which makes the number tick down on its
// own between the 30s polls instead of being frozen at load. Each poll
// re-anchors, so this stays honest. Falls back to the feed's preformatted
// arrivalTimeMessage if we have no anchor or seconds.
type Message = { target: string; secondsToArrival: string; arrivalTimeMessage: string; lineColor: string; headSign: string; };
type Destination = { label: string; messages: Message[]; };
type StationResult = { consideredStation: string; destinations: Destination[]; };
type FeedData = { results: StationResult[]; };

function arrivalParts(m: Message, anchorMs: number | null, nowMs: number) {
  const secs = Number(m.secondsToArrival);
  if (anchorMs && Number.isFinite(secs)) {
    const remainingSec = (anchorMs + secs * 1000 - nowMs) / 1000;
    const mins = Math.max(0, Math.round(remainingSec / 60));
    if (mins === 0) return { mins: "Now", unit: "", now: true };
    return { mins: String(mins), unit: "min", now: false };
  }
  const msg = (m.arrivalTimeMessage || "").trim();
  if (msg.startsWith("0 ")) return { mins: "Now", unit: "", now: true };
  const [n, ...rest] = msg.split(" ");
  return { mins: n || "—", unit: rest.join(" ") || "min", now: false };
}
function messagesFor(destinations: Destination[], key: string): Message[] {
  return (destinations || [])
    .filter((d) => d.label === key)
    .flatMap((d) => d.messages || [])
    .slice()
    .sort((a, b) => Number(a.secondsToArrival) - Number(b.secondsToArrival));
}

// lineColor is usually one 6-hex value, but combined services (the weekend
// "via Hoboken" runs) pack two comma-joined hexes, e.g. "4D92FB,FF9900".
// Split on any non-hex separator and keep the valid 6-char tokens, so this
// is robust to whatever delimiter the feed uses.
function parseColors(lineColor: string): string[] {
  return (lineColor || "").split(/[^0-9A-Fa-f]+/).filter((h) => h.length === 6);
}

// Inline rail style: solid for one colour, a hard top/bottom split for two.
// `color` (used for the next-train glow via currentColor) is the first hex.
function railStyle(colors: string[]) {
  if (colors.length > 1) {
    return {
      background: `linear-gradient(180deg, #${colors[0]} 0 50%, #${colors[1]} 50% 100%)`,
      color: `#${colors[0]}`,
    };
  }
  const c = `#${colors[0] || "888888"}`;
  return { background: c, color: c };
}

function routeLabel(colors: string[], headSign: string): string {
  if (colors.length > 1) {
    if (/via hoboken/i.test(headSign || "")) return "via Hoboken";
    return colors.map((c) => (LINE_INFO as Record<string, string>)[c]).filter(Boolean).join(" · ");
  }
  return (LINE_INFO as Record<string, string>)[colors[0]] || "";
}

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "chevron") return (<svg {...p}><path d="M6 9l6 6 6-6" /></svg>);
  if (name === "close") return (<svg {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>);
  if (name === "home") return (<svg {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>);
  if (name === "star") return (<svg {...p} fill="none"><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" /></svg>);
  return null;
}

function Train({ m, isNext, anchorMs, nowMs }: { m: Message; isNext: boolean; anchorMs: number | null; nowMs: number }) {
  const colors = parseColors(m.lineColor);
  const { mins, unit, now } = arrivalParts(m, anchorMs, nowMs);
  return (
    <div className={"pb-train" + (isNext ? " next" : "") + (now ? " pb-now" : "")}>
      <div className="pb-rail" style={railStyle(colors)} />
      <div className="pb-dest">
        <span className="pb-sign">{m.headSign}</span>
        <span className="pb-route">{routeLabel(colors, m.headSign)}</span>
      </div>
      <div className="pb-when">
        <span className="pb-mins">{mins}</span>
        {unit && <span className="pb-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default function PathBoard() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(loadThemeMode);
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const [home, setHome] = useState(DEFAULT_HOME);
  const [station, setStation] = useState(DEFAULT_HOME);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [data, setData] = useState<FeedData | null>(null);
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Geolocation — request once, cache in state. Used by auto theme.
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords(pos.coords),
      () => setCoords(null),
    );
  }, []);

  // Apply theme to <html> and re-evaluate every minute for auto mode.
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(themeMode, coords);
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, [themeMode, coords]);

  const cycleTheme = () => {
    setThemeMode((prev) => {
      const next: ThemeMode = prev === "auto" ? "light" : prev === "light" ? "dark" : "auto";
      localStorage.setItem("themeMode", next);
      return next;
    });
  };

  const themeLabel = themeMode === "auto" ? "Auto" : themeMode === "light" ? "Light" : "Dark";
  const themeIcon = themeMode === "auto" ? "🌓" : themeMode === "light" ? "☀️" : "🌙";

  const devMode = new URLSearchParams(window.location.search).get("dev") === "true";

  const load = useCallback(async () => {
    if (devMode) {
      setData(SAMPLE); setLive(false);
      setUpdatedAt(new Date()); setFetchedAt(Date.now());
      return;
    }
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (!json || !Array.isArray(json.results)) throw new Error("bad shape");
      setData(json); setLive(true);
      setUpdatedAt(new Date()); setFetchedAt(Date.now());
    } catch (e) {
      if (devMode) {
        setData(SAMPLE);
      }
      setLive(false);
      setUpdatedAt((prev) => prev || new Date());
      setFetchedAt((prev) => prev ?? Date.now());
    }
  }, [devMode]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    const id = setTimeout(() => closeRef.current && closeRef.current.focus(), 60);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(id); };
  }, [drawerOpen]);

  const pick = (code: string) => { setStation(code); setDrawerOpen(false); };

  const stationData = data?.results?.find((r) => r.consideredStation === station) || null;
  const destinations = stationData?.destinations || [];
  const current = BY_CODE[station];

  const clock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const updStr = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    : "—";

  const firstNY = STATIONS.findIndex((s) => s.region === "NY");

  return (
    <div className="pb-root">
      <header className="pb-head">
        <div className="pb-wordmark">
          <span className="pb-mark">PATH Schedule</span>
          <span className={"pb-live" + (live ? "" : " stale")}><i />{live ? "live" : "sample"}</span>
        </div>
        <span className="pb-clock">{clock}</span>
      </header>

      <div className="pb-titlebar">
        <button className="pb-titlebtn" onClick={() => setDrawerOpen(true)}
          aria-haspopup="dialog" aria-expanded={drawerOpen} title="Change station">
          {station === home && <span className="pb-home-icon"><Icon name="home" size={20} /></span>}
          <h1>{current?.name}</h1>
          <span className="chev"><Icon name="chevron" size={26} /></span>
        </button>
        {station !== home && (
          <button className="pb-jump" onClick={() => setStation(home)}>
            <Icon name="home" size={15} /> {BY_CODE[home]?.name}
          </button>
        )}
      </div>

      <main className="pb-body">
        {!data && !devMode && (
          <p className="pb-empty pb-unavailable">Live data unavailable — please try again shortly.</p>
        )}
        {(data || devMode) && DIR.map((d) => {
          const msgs = messagesFor(destinations, d.key);
          if (msgs.length === 0) return null;
          return (
            <section key={d.key}>
              <div className="pb-dir-head">
                <span className="arrow">{d.arrow}</span>
                <span className="lbl">{d.label}</span>
                <span className="rule" />
              </div>
              <div className="pb-trains">
                {msgs.map((m, i) => (
                  <Train key={m.target + i} m={m} isNext={i === 0}
                    anchorMs={fetchedAt} nowMs={now.getTime()} />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="pb-foot">
        <span>
          Updated {updStr}
          {!live && <span className="warn"> · live feed unavailable, showing sample</span>}
        </span>
        <div className="pb-foot-right">
          <button className="pb-theme-btn" onClick={cycleTheme} title={`Theme: ${themeLabel} — click to cycle`}>
            {themeIcon} {themeLabel}
          </button>
          <button className="pb-refresh" onClick={load}>Refresh</button>
        </div>
      </footer>

      {/* Picker */}
      <div className={"pb-scrim" + (drawerOpen ? " open" : "")} onClick={() => setDrawerOpen(false)} />
      <div className={"pb-drawer" + (drawerOpen ? " open" : "")}
        role="dialog" aria-modal="true" aria-label="Choose station">
        <div className="pb-grab" />
        <div className="pb-drawer-head">
          <h2>Choose station</h2>
          <button ref={closeRef} className="pb-close" onClick={() => setDrawerOpen(false)} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="pb-spine">
          {STATIONS.map((s, idx) => (
            <React.Fragment key={s.code}>
              {idx === firstNY && (
                <div className="pb-divider"><span className="seg" /><span className="txt">Hudson River</span><span className="seg" /></div>
              )}
              <div className={"pb-stop" + (s.code === station ? " sel" : "")}>
                <button className="pb-stop-main" onClick={() => pick(s.code)}
                  aria-current={s.code === station ? "true" : undefined}>
                  <span className="pb-node" />
                  <span className="pb-stopinfo">
                    <span className="pb-stoptop">
                      <span className="pb-stopname">{s.name}</span>
                      <span className="pb-stopcode">{s.code}</span>
                    </span>
                    <span className="pb-dots">
                      {s.lines.map((c) => <i key={c} style={{ background: "#" + c }} />)}
                    </span>
                  </span>
                </button>
                <button className={"pb-star" + (s.code === home ? " on" : "")}
                  onClick={() => setHome(s.code)}
                  aria-label={s.code === home ? `${s.name} is your home station` : `Set ${s.name} as home`}
                  aria-pressed={s.code === home}>
                  <svg width="20" height="20" viewBox="0 0 24 24"
                    fill={s.code === home ? "currentColor" : "none"} stroke="currentColor"
                    strokeWidth="2" strokeLinejoin="round">
                    <path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" />
                  </svg>
                </button>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
