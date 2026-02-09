import Image from "next/image";

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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="card p-6 sm:p-8 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
            Über die RAG Schießsport MSE
          </h1>
          <div className="space-y-4 sm:space-y-6 text-base sm:text-lg text-gray-700 leading-relaxed">
            <p>
              Die RAG Schießsport MSE ist eine Reservistenarbeitsgemeinschaft im
              Verband der Reservisten der Deutschen Bundeswehr e. V. in
              Mecklenburg-Vorpommern. Wir sind ein Zusammenschluss
              schießsportinteressierter Verbandsmitglieder aus der Region
              Mecklenburgische Seenplatte.
            </p>
            <p>
              Im Mittelpunkt stehen sportliches Schießen, sichere Waffenhandhabung
              sowie Training und Wettkämpfe nach der Schießsportordnung des
              Verbandes und den waffenrechtlichen Vorgaben. Der Schießsport wird
              dabei als sportlicher Wettbewerb und als Training betrieben;
              Übungen mit militärischem oder polizeilichem Charakter sind im
              schießsportlichen Rahmen ausgeschlossen.
            </p>
            <p>
              Wir bieten regelmäßige Schießtermine, Aus- und Fortbildungen sowie
              kameradschaftliche Treffen. Interessierte sind nach vorheriger
              Anmeldung willkommen - werden Sie Teil unserer Gemeinschaft!
            </p>
          </div>
        </section>

        <section className="card p-6 sm:p-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 text-center">
            Vorstand
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {BOARD_MEMBERS.map((member) => (
              <article
                key={member.name}
                className="w-full max-w-sm mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 text-center"
              >
                <div className="relative h-56 w-44 mx-auto rounded-xl overflow-hidden bg-gray-100">
                  <Image
                    src={member.photo}
                    alt={`Portrait von ${member.name}`}
                    fill
                    className="object-cover"
                    sizes="176px"
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
