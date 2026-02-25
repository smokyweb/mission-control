import { invokeTool } from "@/app/lib/openclaw";
import CalendarClient from "./CalendarClient";

interface CronSchedule {
  kind: string;
  expr?: string;
  tz?: string;
}

interface CronJob {
  id: string;
  label?: string;
  schedule: CronSchedule | string;
  enabled?: boolean;
  lastRun?: number;
  nextRun?: number;
}

async function loadCronJobs(): Promise<CronJob[]> {
  try {
    const result = await invokeTool<CronJob[] | { jobs?: CronJob[] }>("cron", {
      action: "list",
    });
    if (Array.isArray(result)) return result;
    if (result && typeof result === "object" && "jobs" in result) {
      return result.jobs ?? [];
    }
    return [];
  } catch {
    return [];
  }
}

export default async function CalendarPage() {
  const jobs = await loadCronJobs();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
        <p className="text-gray-400 text-sm mt-1">
          Google Calendar events · <span className="text-blue-400">Personal</span> · <span className="text-green-400">Bluestone Apps</span> · <span className="text-purple-400">Cron Jobs</span>
        </p>
      </div>
      <CalendarClient initialJobs={jobs} />
    </div>
  );
}
