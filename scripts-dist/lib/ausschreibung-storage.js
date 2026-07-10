"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAusschreibungenDirectory = getAusschreibungenDirectory;
exports.ensureAusschreibungenDirectory = ensureAusschreibungenDirectory;
exports.getAusschreibungFilePath = getAusschreibungFilePath;
exports.writeAusschreibungFile = writeAusschreibungFile;
exports.readAusschreibungFile = readAusschreibungFile;
exports.deleteAusschreibungFile = deleteAusschreibungFile;
exports.restoreAusschreibungFile = restoreAusschreibungFile;
exports.adoptAusschreibungFile = adoptAusschreibungFile;
const node_path_1 = __importDefault(require("node:path"));
const file_storage_1 = require("./file-storage");
const DEFAULT_AUSSCHREIBUNGEN_SUBDIR = node_path_1.default.join("data", "ausschreibungen");
const ALLOWED_EXTENSIONS = new Set(["pdf"]);
const storage = (0, file_storage_1.createFileStorage)({
    directoryEnvVar: "AUSSCHREIBUNGEN_DIR",
    defaultSubdir: DEFAULT_AUSSCHREIBUNGEN_SUBDIR,
    validateExtension: (extension) => {
        if (!ALLOWED_EXTENSIONS.has(extension)) {
            throw new Error("Ungültiger Dateiname");
        }
    },
});
function getAusschreibungenDirectory() {
    return storage.getDirectory();
}
async function ensureAusschreibungenDirectory() {
    return storage.ensureDirectory();
}
function getAusschreibungFilePath(storedFileName) {
    return storage.getFilePath(storedFileName);
}
async function writeAusschreibungFile(input) {
    return storage.writeFile(input.content, "pdf");
}
async function readAusschreibungFile(storedFileName) {
    return storage.readFile(storedFileName);
}
async function deleteAusschreibungFile(storedFileName) {
    return storage.deleteFile(storedFileName);
}
async function restoreAusschreibungFile(storedFileName, content) {
    return storage.restoreFile(storedFileName, content);
}
async function adoptAusschreibungFile(sourcePath) {
    return storage.adoptFile(sourcePath, "pdf");
}
