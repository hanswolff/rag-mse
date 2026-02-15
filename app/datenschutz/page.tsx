import { BackLink } from "@/components/back-link";

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="card">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-gray-900">Datenschutzerklärung</h1>
          <p className="text-center text-sm text-gray-600 -mt-3 mb-6 sm:mb-8">Zuletzt geändert: 15. Februar 2026</p>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">1. Datenschutz auf einen Blick</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten
              passiert, wenn Sie unsere Website besuchen oder Funktionen im Mitgliederbereich nutzen.
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können. Ausführliche
              Informationen zum Thema Datenschutz finden Sie in den folgenden Abschnitten dieser Erklärung.
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">2. Verantwortlicher</h2>
            <p className="text-base sm:text-base text-gray-800">
              Verantwortlich für die Datenverarbeitung ist die RAG Schießsport MSE. Die Kontaktdaten finden Sie im
              Abschnitt &ldquo;Kontakt für Datenschutz&rdquo; am Ende dieser Seite.
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">3. Hosting und Server-Logs</h2>
            <p className="text-base sm:text-base text-gray-800">
              Wir hosten die Inhalte unserer Website bei folgendem Anbieter:
            </p>
            <p className="mt-2 text-base sm:text-base text-gray-800">
              <strong className="text-gray-900">Anbieter:</strong> Keyweb AG
            </p>
            <p className="text-base sm:text-base text-gray-800">
              <strong>Adresse:</strong> Neuwerkstraße 45/46, D-99084 Erfurt
            </p>
            <p className="text-base sm:text-base text-gray-800">
              <strong>Website:</strong> https://keyweb.de
            </p>
            <p className="mt-4 text-base sm:text-base text-gray-800">
              Beim Aufruf der Website verarbeiten wir Server-Logdaten (z. B. IP-Adresse, Zeitpunkt, aufgerufene Seite,
              User-Agent). Diese Daten werden zur Gewährleistung der Sicherheit und zur Fehleranalyse verarbeitet.
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).
            </p>
            <p className="mt-4 text-base sm:text-base text-gray-800">
              Zusätzlich setzen wir technische Missbrauchsschutz-Mechanismen (Rate-Limiting) ein, z. B. für Login,
              Token-Links und Kontaktanfragen. Dafür verarbeiten wir je nach Endpunkt insbesondere IP-Adresse bzw.
              Client-Identifier sowie Zeitstempel und Zählwerte.
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">4. Mitgliederbereich, Login und Cookies</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Für den Mitgliederbereich verarbeiten wir Ihre Zugangsdaten (E-Mail-Adresse und Passwort). Das Passwort
              wird ausschließlich verschlüsselt (gehasht) gespeichert. Zusätzlich verarbeiten wir Mitgliedsdaten wie
              Name, Adresse, Telefon, Rolle sowie Erstellungs- und Änderungszeitpunkte.
            </p>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Für die Anmeldung setzen wir notwendige Session-Cookies, die für die Nutzung des Mitgliederbereichs
              erforderlich sind. Rechtsgrundlage hierfür ist § 25 Abs. 2 Nr. 2 TDDDG (technisch erforderlich) sowie
              Art. 6 Abs. 1 lit. b und lit. f DSGVO. Die Einwilligung in den Cookie-Hinweis wird in Ihrem Browser lokal
              in <strong>localStorage</strong> gespeichert.
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Rechtsgrundlage für die Verarbeitung im Mitgliederbereich ist Art. 6 Abs. 1 lit. b DSGVO
              (Vertrag/Mitgliedschaft) sowie Art. 6 Abs. 1 lit. f DSGVO (Sicherheit, Betrieb).
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">5. Einladungen und Passwort-Reset</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Admins können Einladungen per E-Mail versenden. Dabei verarbeiten wir die E-Mail-Adresse der eingeladenen
              Person sowie einen Einladungs-Token.
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Bei der &ldquo;Passwort vergessen&rdquo;-Funktion verarbeiten wir Ihre E-Mail-Adresse und speichern einen
              Reset-Token ausschließlich gehasht. Der Token ist zeitlich befristet (24 Stunden). Rechtsgrundlage ist
              Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">6. Termine und Teilnahmeanmeldungen</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Wir verarbeiten Terminangaben (Datum, Uhrzeit, Ort, Beschreibung). Mitglieder können ihre Teilnahme
              (Ja/Nein/Vielleicht) pro Termin anmelden. Pro Mitglied ist eine Anmeldung möglich.
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Admins können die Anmeldungen mit Namen einsehen, um die Organisation zu ermöglichen. Rechtsgrundlage ist
              Art. 6 Abs. 1 lit. b DSGVO (Mitgliedschaft/Organisation).
            </p>
            <p className="mt-4 text-base sm:text-base text-gray-800">
              Sofern in Ihren Benachrichtigungseinstellungen aktiviert, senden wir zusätzlich Termin-Erinnerungen per
              E-Mail. Diese enthalten personalisierte, zeitlich befristete Token-Links zur direkten Anmeldung
              (Ja/Nein/Vielleicht) sowie zur Deaktivierung zukünftiger Erinnerungen. Die Token werden serverseitig nur
              in gehashter Form gespeichert.
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">7. Kontaktformular und E-Mail</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Wenn Sie uns per Kontaktformular Anfragen senden, verarbeiten wir Ihren Namen, Ihre E-Mail-Adresse und
              Ihre Nachricht zur Bearbeitung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Die E-Mail-Zustellung erfolgt über unsere selbst gehostete E-Mail-Infrastruktur. Eine Weitergabe an
              externe E-Mail-Dienstleister findet nicht statt.
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">8. Karten und Geocoding</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Auf der Termin-Detailseite binden wir Karten von OpenStreetMap ein. Dabei werden Inhalte von
              OpenStreetMap-Servern geladen. Es werden technisch notwendige Daten (z. B. IP-Adresse) an OpenStreetMap
              übertragen.
            </p>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Im Adminbereich können Adressen über den Dienst Nominatim (OpenStreetMap) geokodiert werden. Dabei wird
              die eingegebene Adresse an Nominatim übertragen.
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Die Kartenbibliothek Leaflet und Marker-Grafiken werden lokal von unserem Server geladen. Rechtsgrundlage
              ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer nutzerfreundlichen Darstellung von
              Terminen).
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">9. Speicherdauer</h2>
            <p className="mb-4 text-base sm:text-base text-gray-800">
              Wir speichern personenbezogene Daten nur so lange, wie es für die jeweiligen Zwecke erforderlich ist.
              Mitgliedsdaten werden in der Regel bis zum Ende der Mitgliedschaft gespeichert. Kontaktanfragen werden nach
              Abschluss der Bearbeitung gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.
            </p>
            <p className="text-base sm:text-base text-gray-800">
              Server-Logdaten werden für Sicherheits- und Fehleranalysezwecke vorübergehend gespeichert und anschließend
              gelöscht oder anonymisiert.
            </p>
          </section>

          <section className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">
              10. Rechte der betroffenen Person
            </h2>
            <p className="mb-2 text-base sm:text-base text-gray-800">
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung. Zudem steht Ihnen ein Beschwerderecht bei
              einer Aufsichtsbehörde zu.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">11. Kontakt für Datenschutz</h2>
            <p className="mb-2 text-base sm:text-base text-gray-800">
              Bei Fragen zum Datenschutz können Sie sich jederzeit an uns wenden:
            </p>
            <div className="mb-2">
              {/* Using <img> for tiny SVG email obfuscation (389 bytes) - next/image optimizations not applicable */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/email/datenschutz.svg"
                alt="E-Mail-Adresse"
                className="inline-block align-middle"
              />
            </div>
            <p className="text-base sm:text-base text-gray-800">
              <strong className="text-gray-900">Postanschrift:</strong>
              <br />
              Hans Wolff
              <br />
              Wieseneck 32
              <br />
              17192 Waren (Müritz)
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
