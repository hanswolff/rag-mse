"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shootingRangeFormSchema = exports.adminUserValidationConfig = exports.profileValidationConfig = exports.passwordChangeValidationConfig = exports.contactValidationConfig = exports.documentValidationConfig = exports.newsValidationConfig = exports.eventValidationConfig = exports.userValidationConfig = exports.resetPasswordFormSchema = exports.forgotPasswordFormSchema = exports.loginFormSchema = exports.passwordChangeFormSchema = exports.newsFormSchema = exports.eventFormSchema = exports.contactFormSchema = exports.invitationProfileFormSchema = exports.profileFormSchema = exports.validateRole = exports.VALID_ROLES = exports.validateEventType = exports.EVENT_TYPES = exports.getPasswordRequirements = exports.validatePassword = exports.validateContactMessage = exports.validateContactName = exports.validateLongitude = exports.validateLatitude = exports.validateContent = exports.validateTitle = exports.validateDescription = exports.validateLocation = exports.validateTimeString = exports.validateDateString = exports.validateName = exports.validateAddress = exports.validatePhone = exports.validateEmail = exports.hasDigit = exports.hasLowercase = exports.hasUppercase = exports.hasMinimumLength = exports.MAX_PASSWORD_LENGTH = exports.MIN_PASSWORD_LENGTH = exports.requiredEmailSchema = exports.requiredNameSchema = exports.timeRegex = exports.nameRegex = exports.phoneRegex = exports.emailRegex = void 0;
exports.pollValidationConfig = exports.shootingRangeValidationConfig = void 0;
exports.createPasswordSchema = createPasswordSchema;
const zod_1 = require("zod");
const permissions_1 = require("./permissions");
const event_description_1 = require("./event-description");
// Email validation
exports.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Phone validation
exports.phoneRegex = /^[0-9+()\s-]+$/;
// Name validation
exports.nameRegex = /^[a-zA-ZäöüÄÖÜß\s\-'.]+$/;
// Time validation (requires HH:MM format with leading zeros)
exports.timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
function isValidIsoDate(date) {
    const match = isoDateRegex.exec(date);
    if (!match)
        return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31)
        return false;
    const constructed = new Date(year, month - 1, day);
    return (constructed.getFullYear() === year &&
        constructed.getMonth() === month - 1 &&
        constructed.getDate() === day);
}
exports.requiredNameSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Name ist erforderlich")
    .max(100, "Name darf maximal 100 Zeichen lang sein")
    .regex(exports.nameRegex, "Name enthält ungültige Zeichen");
const requiredEmailSchema = (invalidMessage) => zod_1.z
    .string()
    .trim()
    .min(1, "E-Mail ist erforderlich")
    .regex(exports.emailRegex, invalidMessage);
exports.requiredEmailSchema = requiredEmailSchema;
const optionalAddressSchema = zod_1.z
    .string()
    .trim()
    .refine((value) => value.length <= 200, {
    message: "Adresse darf maximal 200 Zeichen lang sein",
});
const optionalPhoneSchema = (invalidCharsMessage) => zod_1.z
    .string()
    .trim()
    .superRefine((value, ctx) => {
    if (!value)
        return;
    if (value.length > 30) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Telefonnummer darf maximal 30 Zeichen lang sein" });
        return;
    }
    if (!exports.phoneRegex.test(value)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: invalidCharsMessage });
    }
});
const optionalIsoDateSchema = zod_1.z
    .string()
    .trim()
    .refine((value) => !value || isValidIsoDate(value), {
    message: "Ungültiges Datum",
});
const optionalDateOfBirthSchema = zod_1.z
    .string()
    .trim()
    .superRefine((value, ctx) => {
    if (!value)
        return;
    if (!isValidIsoDate(value)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Ungültiges Geburtsdatum" });
        return;
    }
    const date = new Date(value);
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    if (date > now) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Geburtsdatum darf nicht in der Zukunft liegen" });
        return;
    }
    if (date < minDate) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Ungültiges Geburtsdatum" });
    }
});
const optionalRankSchema = zod_1.z.string().trim().max(30, "Dienstgrad darf maximal 30 Zeichen lang sein");
const optionalPkSchema = zod_1.z.string().trim().max(20, "PK darf maximal 20 Zeichen lang sein");
const optionalReservistsAssociationSchema = zod_1.z
    .string()
    .trim()
    .max(30, "Reservistenkameradschaft darf maximal 30 Zeichen lang sein");
const optionalAssociationMemberNumberSchema = zod_1.z
    .string()
    .trim()
    .max(30, "Mitgliedsnummer im Verband darf maximal 30 Zeichen lang sein");
const optionalAdminNotesSchema = zod_1.z
    .string()
    .trim()
    .max(4000, "Administratoren-Notizen dürfen maximal 4000 Zeichen lang sein");
const requiredDateSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Datum ist erforderlich")
    .refine((value) => isValidIsoDate(value), {
    message: "Datum ist ungültig",
});
const requiredTimeSchema = (requiredMessage) => zod_1.z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(exports.timeRegex, "Ungültiges Zeitformat");
const requiredLocationSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Ort ist erforderlich")
    .max(200, "Ort darf maximal 200 Zeichen haben");
const requiredDescriptionSchema = zod_1.z
    .string()
    .superRefine((value, ctx) => {
    if (!(0, event_description_1.hasEventDescriptionContent)(value)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Beschreibung ist erforderlich" });
        return;
    }
    if (!(0, event_description_1.isEventDescriptionWithinLimit)(value)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Beschreibung darf maximal ${event_description_1.MAX_EVENT_DESCRIPTION_BYTES.toLocaleString("de-DE")} Bytes haben`,
        });
    }
});
function createCoordinateSchema(min, max, label, required = false) {
    return zod_1.z
        .string()
        .trim()
        .superRefine((value, ctx) => {
        if (!value) {
            if (required) {
                ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: `${label} ist erforderlich` });
            }
            return;
        }
        if (!/^-?\d*\.?\d*$/.test(value)) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: `Ungültiger ${label}` });
            return;
        }
        const num = Number.parseFloat(value);
        if (Number.isNaN(num) || num < min || num > max) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: `Ungültiger ${label} (muss zwischen ${min} und ${max} liegen)` });
        }
    });
}
const optionalLatitudeSchema = createCoordinateSchema(-90, 90, "Breitengrad");
const optionalLongitudeSchema = createCoordinateSchema(-180, 180, "Längengrad");
const requiredTitleSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Titel ist erforderlich")
    .max(200, "Titel darf maximal 200 Zeichen haben");
const requiredContentSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Inhalt ist erforderlich")
    .max(10000, "Inhalt darf maximal 10000 Zeichen haben");
const optionalDocumentDisplayNameSchema = zod_1.z
    .string()
    .superRefine((value, ctx) => {
    const normalized = value.trim();
    if (!normalized) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Dokumentenname darf nicht leer sein" });
        return;
    }
    if (normalized.length > 200) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Dokumentenname darf maximal 200 Zeichen lang sein" });
    }
});
const optionalDocumentDateSchema = zod_1.z
    .string()
    .trim()
    .refine((value) => !value || isValidIsoDate(value), {
    message: "Ungültiges Dokumentdatum",
});
const optionalDocumentDirectoryIdSchema = zod_1.z
    .string()
    .trim()
    .max(100, "Ungültiges Verzeichnis");
const requiredContactNameSchema = zod_1.z
    .string()
    .trim()
    .min(2, "Name muss mindestens 2 Zeichen lang sein")
    .max(100, "Name darf maximal 100 Zeichen lang sein")
    .regex(exports.nameRegex, "Name enthält ungültige Zeichen");
const requiredMessageSchema = zod_1.z
    .string()
    .trim()
    .min(10, "Nachricht muss mindestens 10 Zeichen lang sein")
    .max(2000, "Nachricht darf maximal 2000 Zeichen lang sein");
// Password validation requirements
exports.MIN_PASSWORD_LENGTH = 8;
exports.MAX_PASSWORD_LENGTH = 72;
function createPasswordSchema(requiredMessage) {
    return zod_1.z
        .string()
        .min(1, requiredMessage)
        .max(exports.MAX_PASSWORD_LENGTH, `Passwort darf maximal ${exports.MAX_PASSWORD_LENGTH} Zeichen lang sein`)
        .superRefine((value, ctx) => {
        if (value.length < exports.MIN_PASSWORD_LENGTH) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `Passwort muss mindestens ${exports.MIN_PASSWORD_LENGTH} Zeichen lang sein`,
            });
        }
        if (!/[A-Z]/.test(value)) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Passwort muss mindestens einen Großbuchstaben enthalten" });
        }
        if (!/[a-z]/.test(value)) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Passwort muss mindestens einen Kleinbuchstaben enthalten" });
        }
        if (!/[0-9]/.test(value)) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Passwort muss mindestens eine Ziffer enthalten" });
        }
    });
}
const requiredPasswordSchema = createPasswordSchema("Passwort ist erforderlich");
const hasMinimumLength = (password) => password.length >= exports.MIN_PASSWORD_LENGTH;
exports.hasMinimumLength = hasMinimumLength;
const hasUppercase = (password) => /[A-Z]/.test(password);
exports.hasUppercase = hasUppercase;
const hasLowercase = (password) => /[a-z]/.test(password);
exports.hasLowercase = hasLowercase;
const hasDigit = (password) => /[0-9]/.test(password);
exports.hasDigit = hasDigit;
const validateEmail = (email) => {
    if (typeof email !== "string")
        return false;
    return exports.emailRegex.test(email);
};
exports.validateEmail = validateEmail;
const validatePhone = (phone) => {
    if (typeof phone !== "string")
        return false;
    return optionalPhoneSchema("Telefonnummer enthält ungültige Zeichen").safeParse(phone).success;
};
exports.validatePhone = validatePhone;
const validateAddress = (address) => {
    if (typeof address !== "string")
        return false;
    return optionalAddressSchema.safeParse(address).success;
};
exports.validateAddress = validateAddress;
const validateName = (name) => {
    if (typeof name !== "string")
        return false;
    return exports.requiredNameSchema.safeParse(name).success;
};
exports.validateName = validateName;
const validateDateString = (date) => {
    if (typeof date !== "string")
        return false;
    return isValidIsoDate(date);
};
exports.validateDateString = validateDateString;
const validateTimeString = (time) => {
    if (typeof time !== "string")
        return false;
    return exports.timeRegex.test(time);
};
exports.validateTimeString = validateTimeString;
const validateLocation = (location) => {
    if (typeof location !== "string")
        return false;
    return requiredLocationSchema.safeParse(location).success;
};
exports.validateLocation = validateLocation;
const validateDescription = (description) => {
    if (typeof description !== "string")
        return false;
    return requiredDescriptionSchema.safeParse(description).success;
};
exports.validateDescription = validateDescription;
const validateTitle = (title) => {
    if (typeof title !== "string")
        return false;
    return requiredTitleSchema.safeParse(title).success;
};
exports.validateTitle = validateTitle;
const validateContent = (content) => {
    if (typeof content !== "string")
        return false;
    return requiredContentSchema.safeParse(content).success;
};
exports.validateContent = validateContent;
const validateLatitude = (latitude) => {
    if (typeof latitude !== "string")
        return false;
    return optionalLatitudeSchema.safeParse(latitude).success;
};
exports.validateLatitude = validateLatitude;
const validateLongitude = (longitude) => {
    if (typeof longitude !== "string")
        return false;
    return optionalLongitudeSchema.safeParse(longitude).success;
};
exports.validateLongitude = validateLongitude;
const validateContactName = (name) => {
    if (typeof name !== "string")
        return false;
    return requiredContactNameSchema.safeParse(name).success;
};
exports.validateContactName = validateContactName;
const validateContactMessage = (message) => {
    if (typeof message !== "string")
        return false;
    return requiredMessageSchema.safeParse(message).success;
};
exports.validateContactMessage = validateContactMessage;
const validatePassword = (password) => {
    if (typeof password !== "string")
        return false;
    return requiredPasswordSchema.safeParse(password).success;
};
exports.validatePassword = validatePassword;
const getPasswordRequirements = () => [
    `Mindestens ${exports.MIN_PASSWORD_LENGTH} Zeichen`,
    "Mindestens ein Großbuchstabe",
    "Mindestens ein Kleinbuchstabe",
    "Mindestens eine Ziffer",
];
exports.getPasswordRequirements = getPasswordRequirements;
// Event type validation
exports.EVENT_TYPES = ["Training", "Wettkampf"];
const validateEventType = (type) => {
    if (!type || type.trim() === "")
        return true;
    return exports.EVENT_TYPES.includes(type);
};
exports.validateEventType = validateEventType;
// Role validation
exports.VALID_ROLES = permissions_1.ASSIGNABLE_ROLES;
const validateRole = (role) => {
    if (typeof role !== "string")
        return false;
    return exports.VALID_ROLES.includes(role);
};
exports.validateRole = validateRole;
const requiredRoleSchema = zod_1.z
    .string()
    .trim()
    .refine((value) => (0, exports.validateRole)(value), { message: "Ungültige Rolle" });
// Shared Zod object schemas for frontend + API
exports.profileFormSchema = zod_1.z.object({
    name: exports.requiredNameSchema,
    email: (0, exports.requiredEmailSchema)("E-Mail hat ungültiges Format"),
    address: optionalAddressSchema,
    phone: optionalPhoneSchema("Telefonnummer hat ungültiges Format"),
    dateOfBirth: optionalDateOfBirthSchema,
    rank: optionalRankSchema,
    pk: optionalPkSchema,
    reservistsAssociation: optionalReservistsAssociationSchema,
    associationMemberNumber: optionalAssociationMemberNumberSchema,
    memberSince: optionalIsoDateSchema,
});
exports.invitationProfileFormSchema = exports.profileFormSchema.omit({ email: true, memberSince: true });
exports.contactFormSchema = zod_1.z.object({
    name: requiredContactNameSchema,
    email: (0, exports.requiredEmailSchema)("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
    message: requiredMessageSchema,
});
exports.eventFormSchema = zod_1.z
    .object({
    date: requiredDateSchema,
    timeFrom: requiredTimeSchema("Uhrzeit von ist erforderlich"),
    timeTo: requiredTimeSchema("Uhrzeit bis ist erforderlich"),
    location: requiredLocationSchema,
    description: requiredDescriptionSchema,
    latitude: optionalLatitudeSchema,
    longitude: optionalLongitudeSchema,
})
    .refine((data) => {
    if (data.timeFrom && data.timeTo) {
        const [h1, m1] = data.timeFrom.split(":").map(Number);
        const [h2, m2] = data.timeTo.split(":").map(Number);
        return h1 * 60 + m1 < h2 * 60 + m2;
    }
    return true;
}, {
    message: "Uhrzeit bis muss nach Uhrzeit von liegen",
    path: ["timeTo"],
});
exports.newsFormSchema = zod_1.z.object({
    newsDate: requiredDateSchema,
    title: requiredTitleSchema,
    content: requiredContentSchema,
});
exports.passwordChangeFormSchema = zod_1.z
    .object({
    currentPassword: zod_1.z.string().min(1, "Aktuelles Passwort ist erforderlich"),
    newPassword: createPasswordSchema("Neues Passwort ist erforderlich"),
    confirmPassword: zod_1.z.string().min(1, "Passwortbestätigung ist erforderlich"),
})
    .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Neues Passwort und Passwortbestätigung stimmen nicht überein",
    path: ["confirmPassword"],
})
    .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Neues Passwort muss vom aktuellen Passwort abweichen",
    path: ["newPassword"],
});
exports.loginFormSchema = zod_1.z.object({
    email: (0, exports.requiredEmailSchema)("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
    password: zod_1.z.string().min(1, "Passwort ist erforderlich"),
});
exports.forgotPasswordFormSchema = zod_1.z.object({
    email: (0, exports.requiredEmailSchema)("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});
exports.resetPasswordFormSchema = zod_1.z
    .object({
    password: createPasswordSchema("Passwort ist erforderlich"),
    confirmPassword: zod_1.z.string().min(1, "Passwortbestätigung ist erforderlich"),
})
    .refine((value) => value.password === value.confirmPassword, {
    message: "Die Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
});
// Validation configurations for useFormFieldValidation hook (simplified format)
exports.userValidationConfig = {
    email: { zod: (0, exports.requiredEmailSchema)("E-Mail hat ungültiges Format") },
    name: { zod: exports.requiredNameSchema },
    address: { zod: optionalAddressSchema },
    phone: { zod: optionalPhoneSchema("Telefonnummer hat ungültiges Format") },
};
exports.eventValidationConfig = {
    date: { zod: requiredDateSchema },
    timeFrom: { zod: requiredTimeSchema("Uhrzeit von ist erforderlich") },
    timeTo: { zod: requiredTimeSchema("Uhrzeit bis ist erforderlich") },
    location: { zod: requiredLocationSchema },
    description: { zod: requiredDescriptionSchema },
    latitude: { zod: optionalLatitudeSchema },
    longitude: { zod: optionalLongitudeSchema },
};
exports.newsValidationConfig = {
    newsDate: { zod: requiredDateSchema },
    title: { zod: requiredTitleSchema },
    content: { zod: requiredContentSchema },
};
exports.documentValidationConfig = {
    displayName: { zod: optionalDocumentDisplayNameSchema },
    documentDate: { zod: optionalDocumentDateSchema },
    directoryId: { zod: optionalDocumentDirectoryIdSchema },
};
exports.contactValidationConfig = {
    name: { zod: requiredContactNameSchema },
    email: { zod: (0, exports.requiredEmailSchema)("Bitte geben Sie eine gültige E-Mail-Adresse ein") },
    message: { zod: requiredMessageSchema },
};
exports.passwordChangeValidationConfig = {
    currentPassword: { zod: zod_1.z.string().min(1, "Aktuelles Passwort ist erforderlich") },
    newPassword: { zod: createPasswordSchema("Neues Passwort ist erforderlich") },
    confirmPassword: { zod: zod_1.z.string().min(1, "Passwortbestätigung ist erforderlich") },
};
exports.profileValidationConfig = {
    name: { zod: exports.requiredNameSchema },
    email: { zod: (0, exports.requiredEmailSchema)("E-Mail hat ungültiges Format") },
    address: { zod: optionalAddressSchema },
    phone: { zod: optionalPhoneSchema("Telefonnummer hat ungültiges Format") },
    dateOfBirth: { zod: optionalDateOfBirthSchema },
    rank: { zod: optionalRankSchema },
    pk: { zod: optionalPkSchema },
    reservistsAssociation: { zod: optionalReservistsAssociationSchema },
    associationMemberNumber: { zod: optionalAssociationMemberNumberSchema },
    memberSince: { zod: optionalIsoDateSchema },
};
exports.adminUserValidationConfig = {
    ...exports.profileValidationConfig,
    role: { zod: requiredRoleSchema },
    adminNotes: { zod: optionalAdminNotesSchema },
};
// Shooting range validation schemas
const requiredRangeNameSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Name ist erforderlich")
    .max(100, "Name darf maximal 100 Zeichen lang sein");
const optionalStreetSchema = zod_1.z
    .string()
    .trim()
    .max(200, "Straße darf maximal 200 Zeichen lang sein");
const optionalPostalCodeSchema = zod_1.z
    .string()
    .trim()
    .max(10, "PLZ darf maximal 10 Zeichen lang sein");
const optionalCitySchema = zod_1.z
    .string()
    .trim()
    .max(100, "Ort darf maximal 100 Zeichen lang sein");
const requiredLatitudeSchema = createCoordinateSchema(-90, 90, "Breitengrad", true);
const requiredLongitudeSchema = createCoordinateSchema(-180, 180, "Längengrad", true);
exports.shootingRangeFormSchema = zod_1.z.object({
    name: requiredRangeNameSchema,
    street: optionalStreetSchema,
    postalCode: optionalPostalCodeSchema,
    city: optionalCitySchema,
    latitude: requiredLatitudeSchema,
    longitude: requiredLongitudeSchema,
});
exports.shootingRangeValidationConfig = {
    name: { zod: requiredRangeNameSchema },
    street: { zod: optionalStreetSchema },
    postalCode: { zod: optionalPostalCodeSchema },
    city: { zod: optionalCitySchema },
    latitude: { zod: requiredLatitudeSchema },
    longitude: { zod: requiredLongitudeSchema },
};
const requiredPollOptionSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Option darf nicht leer sein")
    .max(200, "Option darf maximal 200 Zeichen haben");
exports.pollValidationConfig = {
    title: { zod: requiredTitleSchema },
    option: { zod: requiredPollOptionSchema },
};
