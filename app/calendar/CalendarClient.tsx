"use client";

import { useCallback, useEffect, useState } from "react";
import cronstrue from "cronstrue";

// ── Types ──────────────────────────────────────────────────────────────────
interface CronSchedule { kind: string; expr?: string; tz?: string; }
interface CronRun { id?: string; startedAt?: number; finishedAt?: number; status?: string; }
interface CronJob {
  id: string; label?: string; name?: string;
  schedule: CronSchedule | string; enabled?: boolean; lastRun?: number; nextRun?: number;
}
interface GCalEvent {
  id: string; summary: string; description?: string; location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendar: string; calendarId: string;
}
interface EventForm {
  calendarId: string; summary: string; description: string;
  location: string; allDay: boolean; date: string;
  startTime: string; endTime: string;
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDARS = [
  { id: "batmanbluestone@gmail.com", label: "Personal", color: "bg-blue-900/60 text-blue-300" },
  { id: "kevin@knoxwebhq.com", label: "Bluestone Apps", color: "bg-green-900/60 text-green-300" },
];
const CAL_COLOR: Record<string, string> = {
  "batmanbluestone@gmail.com": "bg-blue-900/60 text-blue-300",
  "kevin@knoxwebhq.com": "bg-green-900/60 text-green-300",
};
const CAL_BAR: Record<string, string> = {
  "batmanbluestone@gmail.com": "bg-blue-500",
  "kevin@knoxwebhq.com": "bg-green-500",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function getExpr(s: CronSchedule | string) { return typeof s === "string" ? s : s.expr ?? ""; }
function describeSchedule(s: CronSchedule | string) {
  const expr = getExpr(s);
  try { return cronstrue.toString(expr, { throwExceptionOnParseError: true }); }
  catch { return expr || "Unknown"; }
}
function formatTs(ts?: number) {
  if (!ts) return "—";
  return new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString();
}
function formatTime(dt?: string, date?: string) {
  if (dt) return new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date) return "All day";
  return "";
}
function eventDateStr(ev: GCalEvent) { return (ev.start.dateTime ?? ev.start.date ?? "").slice(0, 10); }
function getWeekDates(offset: number): Date[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
function jobRunsOnDay(job: CronJob, date: Date) {
  const parts = getExpr(job.schedule).split(" ");
  if (parts.length < 5) return false;
  const wd = parts[4];
  if (wd === "*") return true;
  return wd.split(",").map(Number).includes(date.getDay());
}
function toLocalDateTimeInput(dt: string) {
  const d = new Date(dt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function blankForm(date?: string): EventForm {
  const d = date ?? new Date().toISOString().slice(0, 10);
  return { calendarId: "batmanbluestone@gmail.com", summary: "", description: "", location: "", allDay: false, date: d, startTime: "09:00", endTime: "10:00" };
}

// ── Mini Calendar Picker ───────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function MiniCalendar({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const parsed = value ? new Date(value + "T12:00:00") : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const todayStr = new Date().toISOString().slice(0, 10);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const pad = (n: number) => String(n).padStart(2, "0");

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function selectDay(day: number) {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`);
  }

  return (
    <div className="bg-[#0A0A0F] border border-[#2A2A3E] rounded-xl p-3 select-none">
      {/* Month/Year nav */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white rounded transition-colors">‹</button>
        <span className="text-xs font-semibold text-gray-200">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white rounded transition-colors">›</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-600 py-0.5">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const ds = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
          const isSelected = ds === value;
          const isToday = ds === todayStr;
          return (
            <button
              key={i}
              type="button"
              onClick={() => selectDay(day)}
              className={`text-xs w-full aspect-square flex items-center justify-center rounded-full font-medium transition-colors
                ${isSelected
                  ? "bg-blue-600 text-white"
                  : isToday
                  ? "text-blue-400 ring-1 ring-blue-500/50 hover:bg-blue-900/40"
                  : "text-gray-300 hover:bg-[#2A2A3E]"
                }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Event Modal ────────────────────────────────────────────────────────────
function EventModal({ form, setForm, onSave, onClose, saving, mode }: {
  form: EventForm; setForm: (f: EventForm) => void;
  onSave: () => void; onClose: () => void;
  saving: boolean; mode: "add" | "edit";
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A3E] sticky top-0 bg-[#1A1A2E] z-10">
          <h2 className="text-lg font-bold text-white">{mode === "add" ? "New Event" : "Edit Event"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title *</label>
            <input value={form.summary} onChange={e => setForm({...form, summary: e.target.value})}
              placeholder="Event title"
              className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>

          {/* Calendar */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Calendar</label>
            <div className="flex gap-2">
              {CALENDARS.map(cal => (
                <button key={cal.id} onClick={() => setForm({...form, calendarId: cal.id})}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    form.calendarId === cal.id ? "border-white/40 " + cal.color : "border-[#2A2A3E] text-gray-500 hover:text-gray-300"
                  }`}>{cal.label}</button>
              ))}
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400">All day</label>
            <button onClick={() => setForm({...form, allDay: !form.allDay})}
              className={`w-10 h-5 rounded-full transition-colors relative ${form.allDay ? "bg-blue-600" : "bg-gray-700"}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${form.allDay ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          {/* Date — mini calendar picker */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Date</label>
            <MiniCalendar value={form.date} onChange={date => setForm({...form, date})} />
            {/* Fallback text input for manual entry */}
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})}
              className="mt-2 w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>

          {/* Start / End Time */}
          {!form.allDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Start time</label>
                <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})}
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">End time</label>
                <input type="time" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})}
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <input value={form.location} onChange={e => setForm({...form, location: e.target.value})}
              placeholder="Optional location"
              className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              placeholder="Optional notes" rows={3}
              className="w-full bg-[#0A0A0F] border border-[#2A2A3E] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-[#2A2A3E] text-gray-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving || !form.summary.trim()}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
            {saving ? "Saving…" : mode === "add" ? "Add Event" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CalendarClient({ initialJobs }: { initialJobs: CronJob[] }) {
  const [jobs] = useState<CronJob[]>(initialJobs);
  const [weekOffset, setWeekOffset] = useState(0);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalLoading, setGcalLoading] = useState(true);
  const [gcalError, setGcalError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<"events" | "cron">("events");

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [eventForm, setEventForm] = useState<EventForm>(blankForm());
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingCalId, setEditingCalId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<GCalEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cron state
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<Record<string, CronRun[]>>({});
  const [loadingRuns, setLoadingRuns] = useState<string | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const todayStr = new Date().toISOString().slice(0, 10);

  const fetchGCal = useCallback(() => {
    setGcalLoading(true); setGcalError(null);
    const timeMin = weekDates[0].toISOString();
    const timeMax = new Date(weekDates[6].getTime() + 86400000).toISOString();
    fetch(`/api/gcal?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      .then(r => r.json())
      .then(d => { setGcalEvents(d.events ?? []); if (d.error) setGcalError(d.error); })
      .catch(e => setGcalError(String(e)))
      .finally(() => setGcalLoading(false));
  }, [weekOffset]);

  useEffect(() => { fetchGCal(); }, [fetchGCal]);

  const loadRuns = useCallback(async (jobId: string) => {
    setLoadingRuns(jobId);
    try {
      const res = await fetch("/api/openclaw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "cron", args: { action: "runs", id: jobId } }),
      });
      const data = await res.json();
      const runs: CronRun[] = Array.isArray(data.result) ? data.result : data.result?.runs ?? [];
      setRunHistory(prev => ({ ...prev, [jobId]: runs }));
    } catch { /* ignore */ } finally { setLoadingRuns(null); }
  }, []);

  // ── Add event ──
  const openAdd = (date?: string) => {
    setEventForm(blankForm(date ?? selectedDay ?? undefined));
    setEditingEventId(null); setEditingCalId(null);
    setModalMode("add");
  };

  // ── Edit event ──
  const openEdit = (ev: GCalEvent) => {
    const dt = ev.start.dateTime;
    const allDay = !dt;
    setEventForm({
      calendarId: ev.calendarId,
      summary: ev.summary,
      description: ev.description ?? "",
      location: ev.location ?? "",
      allDay,
      date: (ev.start.date ?? ev.start.dateTime ?? "").slice(0, 10),
      startTime: dt ? toLocalDateTimeInput(dt).slice(11) : "09:00",
      endTime: ev.end.dateTime ? toLocalDateTimeInput(ev.end.dateTime).slice(11) : "10:00",
    });
    setEditingEventId(ev.id);
    setEditingCalId(ev.calendarId);
    setModalMode("edit");
  };

  // ── Save (add or edit) ──
  const handleSave = async () => {
    if (!eventForm.summary.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        calendarId: eventForm.calendarId,
        summary: eventForm.summary,
        description: eventForm.description,
        location: eventForm.location,
        allDay: eventForm.allDay,
        date: eventForm.date,
      };
      if (!eventForm.allDay) {
        payload.startDateTime = `${eventForm.date}T${eventForm.startTime}:00`;
        payload.endDateTime = `${eventForm.date}T${eventForm.endTime}:00`;
      }

      if (modalMode === "edit" && editingEventId) {
        payload.eventId = editingEventId;
        await fetch("/api/gcal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/gcal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setModalMode(null);
      fetchGCal();
    } catch (e) { alert("Save failed: " + String(e)); }
    finally { setSaving(false); }
  };

  // ── Delete ──
  const handleDelete = async (ev: GCalEvent) => {
    setDeleting(true);
    try {
      await fetch(`/api/gcal?calendarId=${encodeURIComponent(ev.calendarId)}&eventId=${encodeURIComponent(ev.id)}`, { method: "DELETE" });
      setDeleteConfirm(null);
      fetchGCal();
    } catch (e) { alert("Delete failed: " + String(e)); }
    finally { setDeleting(false); }
  };

  const selectedDayEvents = selectedDay ? gcalEvents.filter(e => eventDateStr(e) === selectedDay) : [];

  return (
    <div>
      {/* Modal */}
      {modalMode && (
        <EventModal form={eventForm} setForm={setEventForm} onSave={handleSave}
          onClose={() => setModalMode(null)} saving={saving} mode={modalMode} />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold mb-2">Delete event?</h3>
            <p className="text-gray-400 text-sm mb-5">
              "<span className="text-white">{deleteConfirm.summary}</span>" will be permanently removed from Google Calendar.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-lg border border-[#2A2A3E] text-gray-400 hover:text-white text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Personal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Bluestone</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"/>Cron</span>
        </div>
        <button onClick={() => openAdd()}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{ background: "#f5c200", color: "#000" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#ffd633")}
          onMouseLeave={e => (e.currentTarget.style.background = "#f5c200")}>
          + Add Event
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setWeekOffset(o => o - 1)} className="px-3 py-1 rounded-lg bg-[#2A2A3E] text-gray-300 hover:text-white text-sm">← Prev</button>
          <span className="text-sm font-medium text-gray-300" suppressHydrationWarning>
            {weekDates[0].toLocaleDateString()} – {weekDates[6].toLocaleDateString()}
          </span>
          <button onClick={() => setWeekOffset(o => o + 1)} className="px-3 py-1 rounded-lg bg-[#2A2A3E] text-gray-300 hover:text-white text-sm">Next →</button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const ds = date.toISOString().slice(0, 10);
            const isToday = ds === todayStr;
            const isSelected = ds === selectedDay;
            const dayEvs = gcalEvents.filter(e => eventDateStr(e) === ds);
            const dayJobs = jobs.filter(j => jobRunsOnDay(j, date));
            return (
              <div key={i} onClick={() => setSelectedDay(ds)}
                className={`rounded-lg p-2 min-h-[90px] border cursor-pointer transition-colors hover:bg-[#1A1A2E] ${
                  isSelected ? "border-white/30 ring-1 ring-white/20" :
                  isToday ? "border-blue-500/50 bg-blue-900/10" : "border-[#2A2A3E] bg-[#0A0A0F]"
                }`}>
                <div className={`text-xs font-medium mb-1 flex items-center justify-between ${isToday ? "text-blue-400" : "text-gray-500"}`}>
                  <span>{DAYS[i]}</span>
                  <span className={isToday ? "text-blue-300 font-bold text-sm" : "text-gray-600"}>{date.getDate()}</span>
                </div>
                <div className="space-y-0.5">
                  {dayEvs.slice(0, 3).map(ev => (
                    <div key={ev.id} className={`text-xs rounded px-1 py-0.5 truncate ${CAL_COLOR[ev.calendarId] ?? "bg-blue-900/40 text-blue-300"}`} title={ev.summary}>
                      {formatTime(ev.start.dateTime, ev.start.date)} {ev.summary}
                    </div>
                  ))}
                  {dayJobs.slice(0, 1).map(job => (
                    <div key={job.id} className="text-xs bg-purple-900/40 text-purple-300 rounded px-1 py-0.5 truncate" title={job.name ?? job.label ?? job.id}>
                      ⚙️ {job.name ?? job.label ?? job.id}
                    </div>
                  ))}
                  {(dayEvs.length + dayJobs.length) > 4 && (
                    <div className="text-xs text-gray-600">+{dayEvs.length + dayJobs.length - 4} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Detail */}
      {selectedDay && (
        <div className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white" suppressHydrationWarning>
              📅 {new Date(selectedDay + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            <button onClick={() => openAdd(selectedDay)} className="text-xs px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg transition-colors">
              + Add
            </button>
          </div>
          {gcalLoading ? (
            <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
          ) : selectedDayEvents.length === 0 ? (
            <p className="text-gray-600 text-sm">No events — click + Add to create one</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map(ev => (
                <div key={ev.id} className="flex gap-3 items-start group">
                  <div className="text-xs text-gray-500 w-20 shrink-0 pt-0.5" suppressHydrationWarning>
                    {formatTime(ev.start.dateTime, ev.start.date)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${CAL_BAR[ev.calendarId] ?? "bg-blue-400"}`} />
                      <p className="text-sm text-white font-medium truncate">{ev.summary}</p>
                    </div>
                    {ev.description && <p className="text-xs text-gray-500 mt-0.5 ml-4 line-clamp-1">{ev.description.replace(/<[^>]+>/g, "")}</p>}
                    {ev.location && <p className="text-xs text-gray-600 mt-0.5 ml-4">📍 {ev.location}</p>}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEdit(ev)} className="text-xs px-2 py-1 bg-[#2A2A3E] hover:bg-blue-800 text-gray-400 hover:text-white rounded transition-colors">✏️</button>
                    <button onClick={() => setDeleteConfirm(ev)} className="text-xs px-2 py-1 bg-[#2A2A3E] hover:bg-red-800 text-gray-400 hover:text-red-300 rounded transition-colors">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("events")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === "events" ? "bg-blue-600 text-white" : "bg-[#1A1A2E] text-gray-400 hover:text-white"}`}>
          📅 All Events ({gcalEvents.length})
        </button>
        <button onClick={() => setTab("cron")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${tab === "cron" ? "bg-purple-700 text-white" : "bg-[#1A1A2E] text-gray-400 hover:text-white"}`}>
          ⚙️ Cron Jobs ({jobs.length})
        </button>
      </div>

      {/* Events List */}
      {tab === "events" && (
        <div className="space-y-2">
          {gcalError && <p className="text-red-400 text-sm mb-3">⚠️ {gcalError}</p>}
          {gcalLoading ? (
            <div className="text-gray-500 text-sm animate-pulse py-8 text-center">Loading calendar…</div>
          ) : gcalEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-600"><p className="text-3xl mb-2">📅</p><p>No events this week</p></div>
          ) : gcalEvents.map(ev => (
            <div key={ev.id} className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl px-5 py-3 flex items-start gap-4 group">
              <div className={`w-1 self-stretch rounded-full shrink-0 ${CAL_BAR[ev.calendarId] ?? "bg-blue-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">{ev.summary}</p>
                {ev.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ev.description.replace(/<[^>]+>/g, "")}</p>}
                <p className="text-xs text-gray-600 mt-0.5">{ev.calendar}</p>
              </div>
              <div className="text-right text-xs text-gray-500 shrink-0" suppressHydrationWarning>
                <p>{new Date((ev.start.dateTime ?? ev.start.date ?? "") + (ev.start.date ? "T12:00:00" : "")).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p>
                <p>{formatTime(ev.start.dateTime, ev.start.date)} – {formatTime(ev.end.dateTime, ev.end.date)}</p>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => openEdit(ev)} className="text-xs px-2 py-1 bg-[#2A2A3E] hover:bg-blue-800 text-gray-400 hover:text-white rounded transition-colors">✏️</button>
                <button onClick={() => setDeleteConfirm(ev)} className="text-xs px-2 py-1 bg-[#2A2A3E] hover:bg-red-800 text-gray-400 hover:text-red-300 rounded transition-colors">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cron Jobs List */}
      {tab === "cron" && (
        <div className="space-y-3">
          {jobs.length === 0 && <div className="text-center py-12 text-gray-600"><p className="text-3xl mb-2">⚙️</p><p>No cron jobs</p></div>}
          {jobs.map(job => (
            <div key={job.id} className="bg-[#1A1A2E] border border-[#2A2A3E] rounded-xl overflow-hidden">
              <button className="w-full text-left px-5 py-4 hover:bg-[#2A2A3E]/50 transition-colors"
                onClick={() => { setExpandedJob(expandedJob === job.id ? null : job.id); if (!runHistory[job.id]) loadRuns(job.id); }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${job.enabled !== false ? "bg-green-400" : "bg-gray-600"}`} />
                      <span className="font-medium text-white">{job.name ?? job.label ?? job.id}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{describeSchedule(job.schedule)}</p>
                    <p className="text-xs text-gray-600 mt-0.5 font-mono">{getExpr(job.schedule)}</p>
                  </div>
                  <div className="text-right shrink-0 text-xs text-gray-500" suppressHydrationWarning>
                    <div>Last: {formatTs(job.lastRun)}</div>
                    <div>Next: {formatTs(job.nextRun)}</div>
                  </div>
                </div>
              </button>
              {expandedJob === job.id && (
                <div className="border-t border-[#2A2A3E] px-5 py-4">
                  {loadingRuns === job.id ? <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
                    : (runHistory[job.id] ?? []).length === 0 ? <p className="text-gray-600 text-sm">No run history</p>
                    : <div className="space-y-2">
                        {(runHistory[job.id] ?? []).slice(0, 10).map((run, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${run.status === "success" ? "bg-green-900/50 text-green-400" : run.status === "error" ? "bg-red-900/50 text-red-400" : "bg-gray-800 text-gray-400"}`}>{run.status ?? "—"}</span>
                            <span className="text-gray-400" suppressHydrationWarning>{formatTs(run.startedAt)}</span>
                            {run.finishedAt && run.startedAt && <span className="text-gray-600 text-xs">{Math.round((run.finishedAt - run.startedAt) / 1000)}s</span>}
                          </div>
                        ))}
                      </div>
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
