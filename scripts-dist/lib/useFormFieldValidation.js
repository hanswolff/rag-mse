"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useFormFieldValidation = useFormFieldValidation;
const react_1 = require("react");
function getValidationError(value, config) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    const parsed = config.zod.safeParse(normalizedValue);
    if (!parsed.success) {
        return parsed.error.issues[0]?.message || "Ungültiger Wert";
    }
    return null;
}
function useFormFieldValidation(config) {
    const [errors, setErrors] = (0, react_1.useState)({});
    const [touched, setTouched] = (0, react_1.useState)({});
    const validateField = (0, react_1.useCallback)((fieldName, value) => {
        const fieldConfig = config[fieldName];
        if (!fieldConfig)
            return;
        const error = getValidationError(value, fieldConfig);
        setErrors((prev) => {
            const nextErrors = { ...prev };
            if (error) {
                nextErrors[fieldName] = error;
            }
            else {
                delete nextErrors[fieldName];
            }
            return nextErrors;
        });
    }, [config]);
    const clearFieldError = (0, react_1.useCallback)((fieldName) => {
        setErrors((prev) => {
            const nextErrors = { ...prev };
            delete nextErrors[fieldName];
            return nextErrors;
        });
    }, []);
    const markFieldAsTouched = (0, react_1.useCallback)((fieldName) => {
        setTouched((prev) => ({ ...prev, [fieldName]: true }));
    }, []);
    const isFieldTouched = (0, react_1.useCallback)((fieldName) => touched[fieldName] || false, [touched]);
    const isFieldValid = (0, react_1.useCallback)((fieldName, value) => {
        const fieldConfig = config[fieldName];
        if (!fieldConfig)
            return true;
        const error = getValidationError(value, fieldConfig);
        return error === null;
    }, [config]);
    const shouldShowError = (0, react_1.useCallback)((fieldName, value, wasSubmitted = false) => {
        const isInvalid = !isFieldValid(fieldName, value);
        const wasTouched = isFieldTouched(fieldName);
        return (wasTouched || wasSubmitted) && isInvalid;
    }, [isFieldValid, isFieldTouched]);
    const isValidAndTouched = (0, react_1.useCallback)((fieldName, value) => {
        const valid = isFieldValid(fieldName, value);
        const wasTouched = isFieldTouched(fieldName);
        return wasTouched && valid && value.trim().length > 0;
    }, [isFieldValid, isFieldTouched]);
    const validateAllFields = (0, react_1.useCallback)((values) => {
        const fieldNames = Object.keys(values);
        const newErrors = {};
        const newTouched = {};
        let allValid = true;
        fieldNames.forEach((fieldName) => {
            // Skip fields that are not in the validation config
            if (!config[fieldName])
                return;
            const value = values[fieldName] ?? "";
            const error = getValidationError(value, config[fieldName]);
            newTouched[fieldName] = true;
            if (error) {
                newErrors[fieldName] = error;
                allValid = false;
            }
        });
        setErrors((prev) => {
            const nextErrors = { ...prev };
            fieldNames.forEach((fieldName) => {
                if (!config[fieldName])
                    return;
                delete nextErrors[fieldName];
            });
            return { ...nextErrors, ...newErrors };
        });
        setTouched((prev) => ({ ...prev, ...newTouched }));
        return allValid;
    }, [config]);
    const reset = (0, react_1.useCallback)(() => {
        setErrors({});
        setTouched({});
    }, []);
    return {
        errors,
        touched,
        validateField,
        validateAllFields,
        clearFieldError,
        isFieldTouched,
        isFieldValid,
        markFieldAsTouched,
        shouldShowError,
        isValidAndTouched,
        reset,
    };
}
