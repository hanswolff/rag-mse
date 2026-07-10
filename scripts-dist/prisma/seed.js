"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = require("node:fs/promises");
const client_1 = require("@prisma/client");
const adapter_better_sqlite3_1 = require("@prisma/adapter-better-sqlite3");
const bcryptjs_1 = require("bcryptjs");
const password_validation_1 = require("../lib/password-validation");
const ausschreibung_storage_1 = require("../lib/ausschreibung-storage");
void Promise.resolve().then(() => __importStar(require("dotenv/config"))).catch(() => undefined);
let prisma;
function getPrismaClient() {
    if (!prisma) {
        const databaseUrl = process.env.DATABASE_URL ?? "file:./data/dev.db";
        const adapter = new adapter_better_sqlite3_1.PrismaBetterSqlite3({ url: databaseUrl });
        prisma = new client_1.PrismaClient({
            adapter,
            log: [
                { emit: "stdout", level: "warn" },
                { emit: "stdout", level: "error" },
            ],
        });
    }
    return prisma;
}
const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_ADMIN_NAME = "Administrator";
const INITIAL_ADMIN_ROLE = "SITE_ADMINISTRATOR";
const PLACEHOLDER_PREFIXES = ["CHANGE_ME", "YOUR_"];
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
async function getAdminCredentials() {
    const isProduction = process.env.NODE_ENV === "production";
    const seedEnabledInProduction = isProduction && process.env.ALLOW_DB_SEED === "true";
    const rawEmail = process.env.SEED_ADMIN_EMAIL;
    const rawPassword = process.env.SEED_ADMIN_PASSWORD;
    const rawName = process.env.SEED_ADMIN_NAME;
    if (!rawEmail?.trim() || !rawPassword?.trim()) {
        console.warn("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set. Skipping admin user seeding.");
        return null;
    }
    if (seedEnabledInProduction) {
        if (!rawName?.trim()) {
            throw new Error("SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD und SEED_ADMIN_NAME müssen für ALLOW_DB_SEED=true in Produktion explizit gesetzt sein");
        }
    }
    const email = rawEmail;
    const password = rawPassword;
    const name = rawName || DEFAULT_ADMIN_NAME;
    if (isProduction && (!email || !password || !name)) {
        throw new Error("SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD und SEED_ADMIN_NAME sind in Produktion erforderlich");
    }
    if (seedEnabledInProduction) {
        const usesPlaceholderPassword = PLACEHOLDER_PREFIXES.some((prefix) => password.startsWith(prefix));
        if (usesPlaceholderPassword) {
            throw new Error("SEED_ADMIN_PASSWORD muss in Produktion explizit gesetzt sein und darf kein Standard- oder Platzhalterwert sein");
        }
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
        throw new Error(`Invalid email format: ${normalizedEmail}`);
    }
    const passwordValidation = (0, password_validation_1.validatePassword)(password);
    if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(", "));
    }
    return { email: normalizedEmail, password, name };
}
async function main(prismaOverride) {
    const prismaClient = prismaOverride || getPrismaClient();
    console.log("Starting database seed...");
    const credentials = await getAdminCredentials();
    if (credentials) {
        const { email: adminEmail, password: adminPassword, name: adminName } = credentials;
        const existingAdmin = await prismaClient.user.findUnique({
            where: { email: adminEmail },
        });
        if (existingAdmin) {
            if (existingAdmin.role === "ADMIN") {
                await prismaClient.user.update({
                    where: { id: existingAdmin.id },
                    data: { role: INITIAL_ADMIN_ROLE },
                });
                console.log(`Existing admin user ${adminEmail} upgraded to role ${INITIAL_ADMIN_ROLE}.`);
            }
            console.log(`Admin user with email ${adminEmail} already exists. Skipping creation.`);
        }
        else {
            const hashedPassword = await (0, bcryptjs_1.hash)(adminPassword, BCRYPT_SALT_ROUNDS);
            const admin = await prismaClient.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    name: adminName,
                    role: INITIAL_ADMIN_ROLE,
                },
            });
            console.log("Admin user created successfully:");
            console.log(`   Email: ${admin.email}`);
            console.log(`   Name: ${admin.name}`);
            console.log(`   Role: ${admin.role}`);
            console.log("");
            console.log("WARNING: Please change the admin password after first login!");
        }
    }
    const shootingRanges = [
        {
            name: "Schützenverein Grischow 1894/1992",
            street: "Oberstriet 2",
            postalCode: "17089",
            city: "Grischow",
            latitude: 53.69290860350169,
            longitude: 13.335883820165746,
        },
        {
            name: "Schützenverein \"Vier Tore\" e.V.",
            street: "Zur Datze 15",
            postalCode: "17034",
            city: "Neubrandenburg",
            latitude: 53.57030963967344,
            longitude: 13.305432186507492,
        },
        {
            name: "Privilegierte Schützengesellschaft zu Güstrow e.V.",
            street: "Koppelweg 12b",
            postalCode: "18273",
            city: "Güstrow",
            latitude: 53.80972484274375,
            longitude: 12.239689271164167,
        },
        {
            name: "Schützengesellschaft 1884 der Reuterstadt Stavenhagen e.V.",
            street: "Stadtholz 4a",
            postalCode: "17153",
            city: "Stavenhagen",
            latitude: 53.70109808691019,
            longitude: 12.924401412887129,
        },
        {
            name: "Schießstand Fürstensee",
            street: null,
            postalCode: "17235",
            city: "Neustrelitz",
            latitude: 53.29723665039616,
            longitude: 13.125446177664209,
        },
        {
            name: "Schützenverein Burg Stargard",
            street: null,
            postalCode: "17094",
            city: "Burg Stargard",
            latitude: 53.499856125744394,
            longitude: 13.347091976262474,
        },
        {
            name: "Schützenzunft Waren Müritz e.V. Schießstand",
            street: "Kargower Weg 5",
            postalCode: "17192",
            city: "Waren (Müritz)",
            latitude: 53.50487941974799,
            longitude: 12.721974213492508,
        },
        {
            name: "Schießstand Wittstock",
            street: "Weg zur Schäferei 2",
            postalCode: "16909",
            city: "Wittstock/Dosse",
            latitude: 53.222420789586586,
            longitude: 12.559584655191628,
        },
        {
            name: "Schützengilde Neustrelitz 1767 e.V.",
            street: "Pappelallee 19",
            postalCode: "17235",
            city: "Neustrelitz",
            latitude: 53.35090444848738,
            longitude: 13.055526434111679,
        },
        {
            name: "Marinetechnikschule Parow",
            street: "Schießplatz der Bundeswehr, Pappelallee 24",
            postalCode: "18445",
            city: "Kramerhof",
            latitude: 54.37460430504266,
            longitude: 13.082525704380235,
        },
    ];
    for (const range of shootingRanges) {
        await prismaClient.shootingRange.upsert({
            where: { name: range.name },
            update: {
                street: range.street,
                postalCode: range.postalCode,
                city: range.city,
                latitude: range.latitude,
                longitude: range.longitude,
            },
            create: range,
        });
    }
    console.log(`Schießstände synchronisiert: ${shootingRanges.length}`);
    await seedLandesmeisterschaftAusschreibung(prismaClient);
}
const LANDESMEISTERSCHAFT_TITLE = "Landesmeisterschaft Schießsport";
const LANDESMEISTERSCHAFT_EXPIRES_AT = new Date(Date.UTC(2026, 7, 1));
const LANDESMEISTERSCHAFT_SOURCE_FILE = "2026-08-01_Ausschreibung_Landesmeisterschaft_Schießsport.pdf";
async function seedLandesmeisterschaftAusschreibung(prismaClient) {
    const existing = await prismaClient.ausschreibung.findFirst({
        where: { title: LANDESMEISTERSCHAFT_TITLE },
    });
    if (existing) {
        console.log(`Ausschreibung "${LANDESMEISTERSCHAFT_TITLE}" existiert bereits. Überspringe Seed.`);
        return;
    }
    const sourcePath = node_path_1.default.join(process.cwd(), "data", LANDESMEISTERSCHAFT_SOURCE_FILE);
    const adopted = await (0, ausschreibung_storage_1.adoptAusschreibungFile)(sourcePath);
    if (!adopted) {
        console.warn(`Quelldatei für Ausschreibungs-Seed nicht gefunden (${sourcePath}). Überspringe Seed.`);
        return;
    }
    const { size: sizeBytes } = await (0, promises_1.stat)(adopted.filePath);
    try {
        await prismaClient.ausschreibung.create({
            data: {
                title: LANDESMEISTERSCHAFT_TITLE,
                expiresAt: LANDESMEISTERSCHAFT_EXPIRES_AT,
                originalFileName: LANDESMEISTERSCHAFT_SOURCE_FILE,
                storedFileName: adopted.storedFileName,
                mimeType: "application/pdf",
                sizeBytes,
            },
        });
    }
    catch (error) {
        try {
            await (0, promises_1.rename)(adopted.filePath, sourcePath);
        }
        catch (renameError) {
            console.error(`Konnte adoptierte Datei nach fehlgeschlagenem Seed nicht zurückverschieben (${adopted.filePath} -> ${sourcePath}):`, renameError);
        }
        throw error;
    }
    console.log(`Ausschreibung "${LANDESMEISTERSCHAFT_TITLE}" angelegt.`);
}
async function run() {
    try {
        await main();
    }
    catch (error) {
        console.error("Seed failed:", error);
        process.exit(1);
    }
    finally {
        await getPrismaClient().$disconnect();
    }
}
if (require.main === module) {
    run();
}
