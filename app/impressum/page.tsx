import { BackLink } from "@/components/back-link";

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="card text-gray-900">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-gray-900">Impressum</h1>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Angaben gemäß § 5 DDG</h2>
            <div className="space-y-2 text-base sm:text-base text-gray-800">
              <p>
                <strong>Verband der Reservisten der Deutschen Bundeswehr e. V.</strong>
              </p>
              <p>Bundesgeschäftsstelle</p>
              <p>Zeppelinstraße 7 A</p>
              <p>53177 Bonn</p>
              <p>Deutschland</p>
            </div>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Untergliederung</h2>
            <div className="space-y-2 text-base sm:text-base text-gray-800">
              <p>RAG Schießsport MSE (Untergliederung des Verbandes der Reservisten der Deutschen Bundeswehr e. V.)</p>
            </div>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">
              Verantwortlich für den Inhalt gemäß § 18 Abs. 2 MStV
            </h2>
            <div className="space-y-2 text-base sm:text-base text-gray-800">
              <p>Hans Wolff</p>
              <p>Wieseneck 32</p>
              <p>17192 Waren (Müritz)</p>
            </div>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">
              Kontakt für diese Website
            </h2>
            <div className="space-y-2 text-base sm:text-base text-gray-800">
              <p>Hans Wolff</p>
              <p>Wieseneck 32</p>
              <p>17192 Waren (Müritz)</p>
              <div>
                {/* Using <img> for tiny SVG email obfuscation (385 bytes) - next/image optimizations not applicable */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/email/kontakt.svg"
                  alt="E-Mail-Adresse"
                  className="inline-block align-middle"
                />
              </div>
            </div>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">
              Verbraucherstreitbeilegung / Universalschlichtungsstelle
            </h2>
            <p className="text-base sm:text-base text-gray-800">
              Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
              teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Haftung für Inhalte</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 DDG für eigene Inhalte
              auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
              §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
              übermittelte oder gespeicherte fremde Informationen zu überwachen oder
              nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
              hinweisen.
            </p>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
              Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
              Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der
              Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden
              von entsprechenden Rechtsverletzungen werden wir diese Inhalte
              umgehend entfernen.
            </p>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Unser Angebot richtet sich an Personen über 18 Jahre. Für die
              Richtigkeit und Vollständigkeit der Angaben übernehmen wir keine
              Gewähr.
            </p>
            <h3 className="text-base sm:text-lg font-semibold mb-2 mt-6 text-gray-900">Haftung für Links</h3>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren
              Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden
              Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
              Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
              verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
              Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige
              Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch
              ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei
              Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend
              entfernen.
            </p>
          </section>
        </div>

        <div className="mt-4 text-center text-base text-gray-800">
          <BackLink href="/" className="font-medium">
            Zurück zur Startseite
          </BackLink>
        </div>
      </div>
    </main>
  );
}
