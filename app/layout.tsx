import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CookieBanner } from "@/components/cookie-banner";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rag-mse.de";

export const metadata: Metadata = {
  title: {
    default: "RAG Schießsport MSE",
    template: "%s | RAG Schießsport MSE"
  },
  description: "Website der RAG Schießsport MSE - Reservistenarbeitsgemeinschaft für sportliches Schießen in Mecklenburg-Vorpommern",
  authors: [{ name: "Hans Wolff" }],
  creator: "Hans Wolff",
  keywords: ["RAG Schießsport MSE", "Reservistenarbeitsgemeinschaft", "Schießsport", "Mecklenburg-Vorpommern", "Schützen"],
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico?v=2" }
    ],
    apple: "/apple-touch-icon.png"
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "RAG Schießsport MSE",
    images: [{
      url: "/og-image.png",
      width: 1200,
      height: 630,
      alt: "RAG Schießsport MSE Logo"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "RAG Schießsport MSE",
    description: "Website der RAG Schießsport MSE",
    images: ["/og-image.png"]
  },
  robots: "index, follow"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased flex flex-col min-h-screen">
        <Providers>
          <Navigation />
          <div className="flex-grow">{children}</div>
          <Footer />
          <CookieBanner />
        </Providers>
      </body>
    </html>
  );
}
