import { invokeTool } from "@/app/lib/openclaw";
import CalendarClient from "./CalendarClient";
import PageHeader from "@/app/components/PageHeader";

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
    <div>
      <PageHeader title="Calendar" subtitle="Google Calendar events · Personal · Bluestone Apps · Cron Jobs" icon="📅" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <CalendarClient initialJobs={jobs} />
      </div>
    </div>
  );
}
