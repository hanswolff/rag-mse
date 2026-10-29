"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useFormFieldValidation, type ValidationConfig } from "@/lib/use-form-field-validation";
import { mapServerErrorToField } from "@/lib/server-error-mapper";
import type { FieldError } from "@/lib/server-error-mapper";

export interface UseFormModalOptions<T extends object> {
  validationConfig: ValidationConfig;
  formData: T;
  setFormData: (data: T) => void;
  defaultData?: T;
  initialData?: T;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  serverErrors?: Record<string, string>;
  fieldErrors?: FieldError[];
  fieldKeywords?: Record<string, string[]>;
  getFieldValues?: (data: T) => Record<string, string>;
  extraValidation?: () => boolean;
}

export function useFormModal<T extends object>({
  validationConfig,
  formData,
  setFormData,
  defaultData,
  initialData,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
  serverErrors = {},
  fieldErrors,
  fieldKeywords,
  getFieldValues,
  extraValidation,
}: UseFormModalOptions<T>) {
  const {
    errors: validationErrors,
    validateField,
    validateAllFields,
    markFieldAsTouched,
    shouldShowError,
    isValidAndTouched,
    reset,
  } = useFormFieldValidation(validationConfig);

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const generalErrors = useMemo(() => {
    if (!fieldKeywords) return {};
    return mapServerErrorToField(serverErrors.general || "", fieldKeywords, fieldErrors);
  }, [serverErrors.general, fieldKeywords, fieldErrors]);

  const [serverErrorSnapshot, setServerErrorSnapshot] = useState({ errors: generalErrors, data: formData });
  if (serverErrorSnapshot.errors !== generalErrors) {
    setServerErrorSnapshot({ errors: generalErrors, data: formData });
  }

  const activeGeneralErrors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(generalErrors).filter(
          ([field]) => formData[field as keyof T] === serverErrorSnapshot.data[field as keyof T]
        )
      ),
    [generalErrors, formData, serverErrorSnapshot]
  );

  const hasUnsavedChanges = useMemo(() => {
    const base = initialData ?? defaultData;
    if (!base) return false;
    return Object.keys(base).some(
      (key) => formData[key as keyof T] !== base[key as keyof T]
    );
  }, [formData, initialData, defaultData]);

  const combinedErrors = useMemo(() => {
    return { ...validationErrors, ...activeGeneralErrors, ...serverErrors };
  }, [validationErrors, activeGeneralErrors, serverErrors]);

  const handleChange = (name: string, value: string | boolean) => {
    setFormData({ ...formData, [name]: value } as T);
    if (typeof value === "string" && validationErrors[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (name: string, value: string) => {
    markFieldAsTouched(name);
    validateField(name, value);
  };

  const getFieldError = (fieldName: string): string | undefined => {
    if (serverErrors[fieldName]) return serverErrors[fieldName];
    if (activeGeneralErrors[fieldName]) return activeGeneralErrors[fieldName];
    if (
      combinedErrors[fieldName] &&
      shouldShowError(fieldName, formData[fieldName as keyof T] as string)
    ) {
      return combinedErrors[fieldName];
    }
    return undefined;
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !isSubmitting) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onClose();
  };

  const cancelClose = () => {
    setShowCloseConfirm(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    let fieldValues: Record<string, string>;
    if (getFieldValues) {
      fieldValues = getFieldValues(formData);
    } else {
      fieldValues = {};
      for (const key of Object.keys(validationConfig)) {
        const val = formData[key as keyof T];
        if (typeof val === "string") {
          fieldValues[key] = val;
        }
      }
    }

    const fieldsValid = validateAllFields(fieldValues);
    const extraValid = extraValidation ? extraValidation() : true;
    if (!fieldsValid || !extraValid) return;

    onSubmit(e);
  };

  return {
    formData,
    setFormData,
    getFieldError,
    handleChange,
    handleBlur,
    handleClose,
    handleSubmit,
    hasUnsavedChanges,
    generalErrors,
    combinedErrors,
    showCloseConfirm,
    handleConfirmClose,
    cancelClose,
    isValidAndTouched,
    shouldShowError,
    validationErrors,
    validateField,
    validateAllFields,
    markFieldAsTouched,
  };
}
