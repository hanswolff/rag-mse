export { metadata } from "./metadata";

import { prisma } from "@/lib/prisma";
import { splitAndSortAusschreibungen } from "@/lib/ausschreibung-validation";
import { PageHeader } from "@/components/page-header";
import { AusschreibungenList } from "@/components/ausschreibungen-list";
import { appName } from "@/lib/site-config";

// Kein Prerendering zur Build-Zeit: die Datenbank existiert nur zur Laufzeit im Container.
export const dynamic = "force-dynamic";

export default async function AusschreibungenPage() {
  const ausschreibungen = await prisma.ausschreibung.findMany({
    orderBy: { expiresAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      expiresAt: true,
      originalFileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  const { current, historical } = splitAndSortAusschreibungen(ausschreibungen);

  return (
    <main className="flex-1 bg-gray-50">
      <PageHeader
        title="Ausschreibungen"
        subtitle={`Bekanntmachungen externer Wettbewerbe und Veranstaltungen, zu denen sich Mitglieder oder Gäste außerhalb der ${appName}-Webseite anmelden können.`}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AusschreibungenList current={current} historical={historical} />
      </div>
    </main>
  );
}
