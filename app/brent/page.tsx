import PageHeader from "@/app/components/PageHeader";
import BrentClient from "./BrentClient";

export default function BrentPage() {
  return (
    <div>
      <PageHeader title="Brent" subtitle="Brent Homer's tasks — managed by Kevin" icon="👤" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BrentClient />
      </div>
    </div>
  );
}
