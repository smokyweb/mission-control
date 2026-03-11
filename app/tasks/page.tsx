import TasksClient from "./TasksClient";
import PageHeader from "@/app/components/PageHeader";

export default function TasksPage() {
  return (
    <div>
      <PageHeader title="Tasks" subtitle="Track work items from open to completed" icon="📋" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <TasksClient />
      </div>
    </div>
  );
}
