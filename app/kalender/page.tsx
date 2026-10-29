export { metadata } from "./metadata";

import { PageHeader } from "@/components/page-header";
import { CalendarView } from "@/components/calendar/calendar-view";

export default function KalenderPage() {
  return (
    <main className="flex-1 bg-gray-50">
      <PageHeader title="Kalender" subtitle="Termine, Fremdtermine und Abwesenheiten im Überblick" />
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-6 sm:py-8">
        <CalendarView />
      </div>
    </main>
  );
}
