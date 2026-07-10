"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileStorage = createFileStorage;
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
function isEnoent(error) {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
function createFileStorage(config) {
    function getDirectory() {
        const configuredDir = process.env[config.directoryEnvVar]?.trim();
        if (configuredDir) {
            return configuredDir;
        }
        return node_path_1.default.join(process.cwd(), config.defaultSubdir);
    }
    async function ensureDirectory() {
        const directory = getDirectory();
        await node_fs_1.promises.mkdir(directory, { recursive: true });
        return directory;
    }
    function getFilePath(storedFileName) {
        if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(storedFileName)) {
            throw new Error("Ungültiger Dateiname");
        }
        const extension = storedFileName.split(".").pop() || "";
        config.validateExtension(extension);
        return node_path_1.default.join(getDirectory(), storedFileName);
    }
    async function writeFile(content, extension) {
        const directory = await ensureDirectory();
        const storedFileName = `${(0, node_crypto_1.randomUUID)().replace(/-/g, "")}.${extension}`;
        const filePath = node_path_1.default.join(directory, storedFileName);
        await node_fs_1.promises.writeFile(filePath, content);
        return { storedFileName, filePath };
    }
    async function readFile(storedFileName) {
        return node_fs_1.promises.readFile(getFilePath(storedFileName));
    }
    async function deleteFile(storedFileName) {
        const filePath = getFilePath(storedFileName);
        try {
            await node_fs_1.promises.unlink(filePath);
        }
        catch (error) {
            if (isEnoent(error)) {
                return;
            }
            throw error;
        }
    }
    async function restoreFile(storedFileName, content) {
        await ensureDirectory();
        await node_fs_1.promises.writeFile(getFilePath(storedFileName), content);
    }
    async function adoptFile(sourcePath, extension) {
        let sourceStat;
        try {
            sourceStat = await node_fs_1.promises.stat(sourcePath);
        }
        catch (error) {
            if (isEnoent(error)) {
                return null;
            }
            throw error;
        }
        if (!sourceStat.isFile()) {
            return null;
        }
        const directory = await ensureDirectory();
        const storedFileName = `${(0, node_crypto_1.randomUUID)().replace(/-/g, "")}.${extension}`;
        const filePath = node_path_1.default.join(directory, storedFileName);
        await node_fs_1.promises.rename(sourcePath, filePath);
        return { storedFileName, filePath };
    }
    return { getDirectory, ensureDirectory, getFilePath, writeFile, readFile, deleteFile, restoreFile, adoptFile };
}
