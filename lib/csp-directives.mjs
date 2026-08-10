// Einzige Quelle der CSP-Direktiven. next.config.mjs liefert daraus den
// erzwingenden Header, proxy.ts den Report-Only-Header mit Nonce. Ohne
// gemeinsame Quelle würden beide auseinanderlaufen und der Report-Only-Lauf
// träfe Aussagen über eine Policy, die so nie erzwungen wird.

const OPENSTREETMAP_TILES = "https://*.tile.openstreetmap.org";
const OPENSTREETMAP = "https://*.openstreetmap.org";

/**
 * @param {{ scriptSrc: string }} options
 * @returns {string}
 */
export function buildContentSecurityPolicy({ scriptSrc }) {
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${OPENSTREETMAP_TILES} ${OPENSTREETMAP}`,
    "font-src 'self' data:",
    `connect-src 'self' ${OPENSTREETMAP} ${OPENSTREETMAP_TILES}`,
    `frame-src 'self' ${OPENSTREETMAP}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

/**
 * Der bislang erzwungene script-src. Er erlaubt Inline-Skripte pauschal, weil
 * der App Router in Produktion Bootstrap-/Hydration-Skripte inline ausgibt.
 * @param {boolean} isProduction
 * @returns {string}
 */
export function getPermissiveScriptSrc(isProduction) {
  return isProduction
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com";
}

/**
 * script-src mit Nonce. 'strict-dynamic' erlaubt den nonce-markierten Skripten,
 * ihre Chunks nachzuladen; ohne das wäre jeder nachgeladene Chunk ein Verstoß.
 *
 * Achtung: 'strict-dynamic' setzt in CSP3-fähigen Browsern `'self'`,
 * `'unsafe-inline'` UND alle Host-Einträge außer Kraft; dort zählt
 * ausschließlich die Nonce. Genau deshalb verlieren statisch vorgerenderte
 * Seiten, deren HTML keine Nonce trägt, sämtliche Skripte
 * (siehe docs/CSP_NONCE_ROLLOUT.md).
 *
 * `'self'` ist der Rückfall für CSP2-Browser, die 'strict-dynamic' nicht kennen.
 * `'unsafe-inline'` greift dagegen nur noch in CSP1-Browsern: Sobald eine Nonce
 * in der Direktive steht, ignoriert es jeder CSP2-fähige Browser. Es ist also
 * kein Sicherheitsnetz für die Umstellung — was der Report-Only-Lauf meldet,
 * würde beim Erzwingen genauso blockiert.
 * @param {string} nonce
 * @param {boolean} isProduction
 * @returns {string}
 */
export function getNonceScriptSrc(nonce, isProduction) {
  const base = `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`;
  return isProduction ? base : `${base} 'unsafe-eval'`;
}
