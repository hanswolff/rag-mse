import Link from "next/link";
import { VERSION_INFO } from "@/lib/version-info";

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_0.5fr_0.5fr] gap-4 sm:gap-5">
          <div>
            <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-2.5 text-brand-gold-400">
              RAG Schießsport MSE
            </h3>
            <p className="text-sm text-brand-blue-100 mb-1 sm:mb-1.5">
              Untergliederung des Verbandes der Reservisten der Deutschen Bundeswehr e. V.
            </p>
            <p className="text-[10px] text-gray-400">
              &copy; {new Date().getFullYear()} RAG Schießsport MSE &bull; v{VERSION_INFO.version} &bull; Build-Datum: {VERSION_INFO.buildDate}
            </p>
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-2.5 text-brand-gold-400">Links</h3>
            <ul className="space-y-0.5 sm:space-y-1 text-sm">
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
            <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-2.5 text-brand-gold-400">Rechtliches</h3>
            <ul className="space-y-0.5 sm:space-y-1 text-sm">
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
      </div>
    </footer>
  );
}
