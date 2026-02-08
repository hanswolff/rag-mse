import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutzerklärung" },
] as const;

const EXTERNAL_LINKS = [
  { href: "https://github.com/hanswolff/rag-mse", label: "GitHub" },
] as const;

const FOOTER_LINK_CLASS =
  "text-brand-blue-100 hover:text-brand-gold-400 transition-colors py-1";

export function Footer() {
  return (
    <footer className="bg-brand-blue-900 text-white mt-auto border-t-4 border-brand-red-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-brand-gold-400">
              RAG Schießsport MSE
            </h3>
            <p className="text-base text-brand-blue-100">
              Untergliederung des Verbandes der Reservisten der Deutschen Bundeswehr e. V.
            </p>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-brand-gold-400">Links</h3>
            <ul className="space-y-1 sm:space-y-2 text-base">
              {EXTERNAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={FOOTER_LINK_CLASS}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-brand-gold-400">Rechtliches</h3>
            <ul className="space-y-1 sm:space-y-2 text-base">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={FOOTER_LINK_CLASS}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-brand-blue-800 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-base text-brand-blue-100">
          <p>&copy; {new Date().getFullYear()} RAG Schießsport MSE</p>
        </div>
      </div>
    </footer>
  );
}
