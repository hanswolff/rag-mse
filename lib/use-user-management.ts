import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useAdminEntityManagement } from "./use-admin-entity-management";
import { normalizeDateInputValue } from "./date-picker-utils";
import { validateEmail } from "./validation-schema";
import type { User, NewUser } from "@/types";

const initialNewUser: NewUser = {
  email: "",
  name: "",
  address: "",
  phone: "",
  role: "MEMBER",
  memberSince: "",
  dateOfBirth: "",
  rank: "",
  pk: "",
  reservistsAssociation: "",
  associationMemberNumber: "",
  hasPossessionCard: false,
  adminNotes: "",
};

function userToFormData(user: User): NewUser {
  return {
    email: user.email,
    name: user.name,
    address: user.address || "",
    phone: user.phone || "",
    role: user.role,
    memberSince: normalizeDateInputValue(user.memberSince),
    dateOfBirth: normalizeDateInputValue(user.dateOfBirth),
    rank: user.rank || "",
    pk: user.pk || "",
    reservistsAssociation: user.reservistsAssociation || "",
    associationMemberNumber: user.associationMemberNumber || "",
    hasPossessionCard: user.hasPossessionCard || false,
    adminNotes: user.adminNotes || "",
  };
}

export function useUserManagement() {
  const router = useRouter();
  const { status } = useAdminAuth();
  const { createFetchHandler, createFetchDataHandler } = useAdminCrud();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isResendingInvite, setIsResendingInvite] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");

  const fetchUsersRef = useRef<() => Promise<void> | void>(() => {});

  const management = useAdminEntityManagement<User, NewUser>({
    endpoint: "/api/admin/users",
    emptyForm: initialNewUser,
    itemToForm: userToFormData,
    updateMethod: "PATCH",
    messages: {
      created: (data) => `Benutzer ${(data as { name: string }).name} wurde erfolgreich erstellt`,
      updated: (data) => `Benutzer ${(data as { name: string }).name} wurde erfolgreich aktualisiert`,
      deleted: "Benutzer wurde erfolgreich gelöscht",
    },
    refetch: () => fetchUsersRef.current(),
  });

  const { setError, setSuccess } = management;

  const fetchUsers = useMemo(
    () =>
      createFetchDataHandler<User[]>(
        "/api/admin/users",
        setUsers,
        setError,
        setIsLoading,
        router
      ),
    [createFetchDataHandler, router, setError]
  );

  useEffect(() => {
    fetchUsersRef.current = fetchUsers;
  }, [fetchUsers]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchUsers();
    }
  }, [status, fetchUsers]);

  const sendInvite = useMemo(
    () =>
      createFetchHandler<{ email: string }>(
        "/api/admin/invitations",
        "POST",
        setError,
        setIsSendingInvite,
        { email: inviteEmail }
      ),
    [createFetchHandler, inviteEmail, setError]
  );

  const handleSendInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");

    const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedInviteEmail) {
      setInviteError("E-Mail ist erforderlich");
      return;
    }

    if (!validateEmail(normalizedInviteEmail)) {
      setInviteError("Bitte geben Sie eine gültige E-Mail-Adresse ein");
      return;
    }

    const result = await sendInvite();
    if (result.success) {
      setSuccess("Einladung wurde erfolgreich versendet");
      setInviteEmail("");
      return;
    }
    setError("");
    setInviteError("Einladung konnte nicht versendet werden. Bitte Eingabe prüfen.");
  }, [sendInvite, inviteEmail, setError, setSuccess]);

  const handleResendInvitation = useCallback(async (email: string) => {
    setIsResendingInvite(email);
    setError("");
    try {
      const response = await fetch("/api/admin/invitations/resend-by-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-protection": "1" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json() as { message?: string; error?: string };
      if (response.ok) {
        setSuccess(data.message || "Einladung wurde erneut versendet");
      } else {
        setError(data.error || "Einladung konnte nicht versendet werden");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.");
    } finally {
      setIsResendingInvite(null);
    }
  }, [setError, setSuccess]);

  const handleInviteEmailChange = useCallback((value: string) => {
    setInviteEmail(value);
    if (inviteError) {
      setInviteError("");
    }
  }, [inviteError]);

  const canDeleteUser = useCallback((userId: string): boolean => {
    const user = users.find((u) => u.id === userId);
    if (!user) return false;

    if (user.role === "SITE_ADMINISTRATOR") return false;

    if (user.role !== "ADMIN") return true;

    const adminCount = users.filter((u) => u.role === "ADMIN").length;
    return adminCount > 1;
  }, [users]);

  return {
    users,
    isLoading,
    isCreatingUser: management.isCreating,
    isDeletingUser: management.isDeleting,
    isUpdatingUser: management.isUpdating,
    isSendingInvite,
    error: management.error,
    fieldErrors: management.fieldErrors,
    success: management.success,
    inviteEmail,
    inviteError,
    modalUserData: management.modalData,
    setModalUserData: management.setModalData,
    initialUserData: management.initialData,
    isModalOpen: management.isModalOpen,
    editingUser: management.editingItem,
    isResendingInvite,
    handleResendInvitation,
    setInviteEmail: handleInviteEmailChange,
    handleCreateUser: management.handleCreate,
    handleUpdateUser: management.handleUpdate,
    handleSendInvite,
    handleDeleteUser: management.handleDelete,
    startEditingUser: management.startEditing,
    openCreateModal: management.openCreateModal,
    openEditModal: management.startEditing,
    closeModal: management.closeModal,
    canDeleteUser,
  };
}

export type { User, NewUser };
