"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EVENT_DESCRIPTION_BYTES = void 0;
exports.getUtf8ByteLength = getUtf8ByteLength;
exports.isEventDescriptionWithinLimit = isEventDescriptionWithinLimit;
exports.sanitizeEventDescriptionHtml = sanitizeEventDescriptionHtml;
exports.stripEventDescriptionText = stripEventDescriptionText;
exports.hasEventDescriptionContent = hasEventDescriptionContent;
exports.formatEventDescriptionForDisplay = formatEventDescriptionForDisplay;
exports.getEventDescriptionPreview = getEventDescriptionPreview;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
exports.MAX_EVENT_DESCRIPTION_BYTES = 1024 * 1024;
const EVENT_DESCRIPTION_SANITIZE_OPTIONS = {
    allowedTags: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "a", "blockquote"],
    allowedAttributes: {
        a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
    transformTags: {
        a: (_tagName, attribs) => ({
            tagName: "a",
            attribs: {
                ...attribs,
                rel: "noopener noreferrer nofollow",
                target: "_blank",
            },
        }),
    },
};
const STRIP_ALL_HTML_OPTIONS = {
    allowedTags: [],
    allowedAttributes: {},
};
function getUtf8ByteLength(value) {
    return new TextEncoder().encode(value).length;
}
function isEventDescriptionWithinLimit(value) {
    return getUtf8ByteLength(value) <= exports.MAX_EVENT_DESCRIPTION_BYTES;
}
function sanitizeEventDescriptionHtml(value) {
    const normalized = typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
    return (0, sanitize_html_1.default)(normalized, EVENT_DESCRIPTION_SANITIZE_OPTIONS).trim();
}
function stripEventDescriptionText(value) {
    const normalized = typeof value === "string" ? value : "";
    return (0, sanitize_html_1.default)(normalized, STRIP_ALL_HTML_OPTIONS)
        .replace(/\u00a0/g, " ")
        .replace(/[ \t\f\v]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function decodeHtmlEntities(value) {
    return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, content) => {
        const named = {
            amp: "&",
            lt: "<",
            gt: ">",
            quot: '"',
            apos: "'",
            nbsp: " ",
        };
        const lower = content.toLowerCase();
        if (named[lower]) {
            return named[lower];
        }
        if (lower.startsWith("#x")) {
            const codePoint = Number.parseInt(lower.slice(2), 16);
            return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
        }
        if (lower.startsWith("#")) {
            const codePoint = Number.parseInt(lower.slice(1), 10);
            return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
        }
        return entity;
    });
}
function hasEventDescriptionContent(value) {
    return stripEventDescriptionText(value).length > 0;
}
function formatEventDescriptionForDisplay(value) {
    const normalized = typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
    if (/<\/?[a-z][\s\S]*>/i.test(normalized)) {
        return sanitizeEventDescriptionHtml(normalized);
    }
    const escapedText = (0, sanitize_html_1.default)(normalized, STRIP_ALL_HTML_OPTIONS);
    return escapedText.replace(/\n/g, "<br />");
}
function getEventDescriptionPreview(value, maxChars = 180) {
    const plain = decodeHtmlEntities(stripEventDescriptionText(value));
    if (plain.length <= maxChars) {
        return plain;
    }
    return `${plain.slice(0, maxChars - 1).trimEnd()}…`;
}
