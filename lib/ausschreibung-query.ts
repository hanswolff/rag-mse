import { prisma } from "@/lib/prisma";
import { getTodayUtcMidnight } from "@/lib/ausschreibung-validation";
import { getVisibilityFilter } from "@/lib/visibility";

export type NaechsteAusschreibung = {
  id: string;
  title: string;
  expiresAt: Date;
};

// Die "Nächste Ausschreibung" (CONTEXT.md): die aktuelle Ausschreibung mit dem
// frühesten Ablaufdatum. Der Filter `gte` auf Mitternacht UTC des heutigen
// deutschen Tages bildet die Grenze "gilt bis einschließlich des Ablauftages" ab —
// dieselbe Semantik wie isAusschreibungCurrent, nur als Datenbankfilter statt im
// Speicher. `gt` würde die heute ablaufende Ausschreibung fälschlich ausblenden.
// `isLoggedIn` entscheidet zusätzlich über die Sichtbarkeitsstufe: eine nur für
// Mitglieder freigegebene Ausschreibung darf die Startseite anonym nicht ankündigen.
export async function getNaechsteAktuelleAusschreibung(
  isLoggedIn: boolean,
  referenceDate: Date = new Date()
): Promise<NaechsteAusschreibung | null> {
  return prisma.ausschreibung.findFirst({
    where: {
      expiresAt: { gte: getTodayUtcMidnight(referenceDate) },
      ...getVisibilityFilter(isLoggedIn),
    },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true,
      title: true,
      expiresAt: true,
    },
  });
}
