"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePassword = validatePassword;
exports.getPasswordRequirements = getPasswordRequirements;
exports.getPasswordRequirementsWithStatus = getPasswordRequirementsWithStatus;
const validation_schema_1 = require("./validation-schema");
function validatePassword(password) {
    const errors = [];
    if (typeof password !== "string") {
        return { isValid: false, errors: ["Passwort ist erforderlich"] };
    }
    if (password.length > validation_schema_1.MAX_PASSWORD_LENGTH) {
        errors.push(`Passwort darf maximal ${validation_schema_1.MAX_PASSWORD_LENGTH} Zeichen lang sein`);
    }
    if (!(0, validation_schema_1.hasMinimumLength)(password)) {
        errors.push(`Passwort muss mindestens ${validation_schema_1.MIN_PASSWORD_LENGTH} Zeichen lang sein`);
    }
    if (!(0, validation_schema_1.hasUppercase)(password)) {
        errors.push("Passwort muss mindestens einen Großbuchstaben enthalten");
    }
    if (!(0, validation_schema_1.hasLowercase)(password)) {
        errors.push("Passwort muss mindestens einen Kleinbuchstaben enthalten");
    }
    if (!(0, validation_schema_1.hasDigit)(password)) {
        errors.push("Passwort muss mindestens eine Ziffer enthalten");
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
function getPasswordRequirements() {
    return (0, validation_schema_1.getPasswordRequirements)();
}
function getPasswordRequirementsWithStatus(password) {
    return [
        { label: `Mindestens ${validation_schema_1.MIN_PASSWORD_LENGTH} Zeichen`, met: (0, validation_schema_1.hasMinimumLength)(password) },
        { label: "Mindestens ein Großbuchstabe", met: (0, validation_schema_1.hasUppercase)(password) },
        { label: "Mindestens ein Kleinbuchstabe", met: (0, validation_schema_1.hasLowercase)(password) },
        { label: "Mindestens eine Ziffer", met: (0, validation_schema_1.hasDigit)(password) },
    ];
}
