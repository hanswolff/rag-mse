export { metadata } from "./metadata";

import Image from "next/image";
import { PageHeader } from "@/components/page-header";
import { appName, appDescription } from "@/lib/site-config";

const BOARD_MEMBERS = [
  {
    name: "Jörg Teske",
    role: "Vorstandsvorsitzender",
    photo: "/photos/joerg_teske.jpg",
  },
  {
    name: "Hans Wolff",
    role: "Stellvertretender Vorstandsvorsitzender",
    photo: "/photos/hans_wolff.jpg",
  },
] as const;

export default function UeberUnsPage() {
  return (
    <main className="flex-1 bg-gray-50">
      <PageHeader title={`Über die ${appName}`} subtitle={appDescription} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card mb-6 border border-slate-100 p-6 shadow-xl shadow-slate-200/60 sm:mb-8 sm:p-8">
          <span className="section-kicker">Gemeinschaft</span>
          <div className="space-y-4 pt-3 text-base leading-relaxed text-gray-700 sm:text-lg">
            <p>
              Der Verband der Reservisten der Deutschen Bundeswehr e. V. ist ein
              vom Bundesverwaltungsamt anerkannter Schießsportverband mit
              eigener Schießsportordnung (SSpO VdRBw e. V.). Diese Anerkennung
              bedeutet jedoch nicht, dass jedes Verbandsmitglied automatisch
              waffenrechtliche Befugnisse besitzt.
            </p>
            <p>
              Aus waffenrechtlichen Gründen dürfen den Schießsport im VdRBw e.
              V. ausschließlich Mitglieder einer RAG Schießsport sowie die
              Schießsport-Verantwortlichen der jeweiligen Verbandsebene
              eigenständig organisieren und durchführen.
              Reservistenkameradschaften, andere Untergliederungen oder
              Vorgesetzte des Reservistenverbandes erhalten daraus keine eigenen
              waffenrechtlichen oder schießsportlichen Befugnisse.
            </p>
            <p>
              Die {appName} ist eine Reservistenarbeitsgemeinschaft im Verband
              der Reservisten der Deutschen Bundeswehr e. V. der Landesgruppe
              Mecklenburg-Vorpommern. Wir sind ein Zusammenschluss
              schießsportinteressierter Verbandsmitglieder aus der Region
              Mecklenburgische Seenplatte.
            </p>
            <p>
              Unsere Mitglieder betreiben den zivilen Schießsport entsprechend
              der genehmigten Schießsportordnung ausschließlich in
              Zivilkleidung. Das Tragen von Bekleidung mit Tarnmuster, Uniformen
              aller Streitkräfte sowie deren Hoheitsabzeichen ist nicht
              gestattet.
            </p>
            <p>
              Im Mittelpunkt stehen sportliches Schießen, sichere
              Waffenhandhabung, Training und Wettkämpfe nach den Vorgaben des
              Verbandes. Übungen mit militärischem oder polizeilichem Charakter
              sind im schießsportlichen Rahmen ausgeschlossen.
            </p>
            <p>
              Wir bieten regelmäßige Schießtermine, Aus- und Fortbildungen,
              Meisterschaften und kameradschaftliche Treffen. Interessierte sind
              nach vorheriger Anmeldung willkommen – werde Teil unserer
              Gemeinschaft!
            </p>
          </div>
        </section>

        <section className="card border border-slate-100 shadow-xl shadow-slate-200/60 p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
            Vorstand
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {BOARD_MEMBERS.map((member) => (
              <article
                key={member.name}
                className="w-full max-w-sm mx-auto rounded-[1.75rem] border border-gray-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 text-center shadow-sm transition-all duration-300 card-hover-lift sm:p-6"
              >
                <div className="relative h-48 w-36 sm:h-56 sm:w-44 mx-auto overflow-hidden rounded-xl bg-gray-100 ring-2 ring-brand-blue-100">
                  <Image
                    src={member.photo}
                    alt={`Portrait von ${member.name}`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 640px) 176px, 144px"
                  />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mt-4 mb-1">
                  {member.name}
                </h3>
                <p className="text-base sm:text-base text-brand-blue-700 font-medium">
                  {member.role}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
