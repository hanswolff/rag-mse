import Link from "next/link";

export const metadata = {
  title: "Seite nicht gefunden",
};

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-6xl font-bold text-brand-red-600 mb-4">404</p>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Seite nicht gefunden</h1>
      <p className="text-gray-600 mb-8">
        Die aufgerufene Seite existiert nicht oder wurde verschoben.
      </p>
      <Link href="/" className="btn-primary inline-block">
        Zur Startseite
      </Link>
    </div>
  );
}
