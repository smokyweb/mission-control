import TasksClient from "./TasksClient";

export default function TasksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tasks</h1>
        <p className="text-gray-400 text-sm mt-1">
          Track work items from open to completed
        </p>
      </div>
      <TasksClient />
    </div>
  );
}
