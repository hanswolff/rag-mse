const appName =
  process.env.NEXT_PUBLIC_APP_NAME ||
  process.env.APP_NAME ||
  "RAG Schießsport MSE";

const appTagline =
  process.env.NEXT_PUBLIC_APP_TAGLINE ||
  "Sportliches Schießen an der Mecklenburgischen Seenplatte";

const appDescription =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
  "Reservistenarbeitsgemeinschaft für sportliches Schießen an der Mecklenburgischen Seenplatte";

export { appName, appTagline, appDescription };
