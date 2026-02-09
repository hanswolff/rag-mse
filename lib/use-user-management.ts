import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "./use-admin-auth";
import { useAdminCrud } from "./use-admin-crud";
import { useSuccessTimer } from "./use-success-timer";
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
  hasPossessionCard: false,
};

export function useUserManagement() {
  const router = useRouter();
  const { status } = useAdminAuth();
  const { createFetchHandler, createDeleteHandler, createFetchDataHandler } = useAdminCrud();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [modalUserData, setModalUserData] = useState<NewUser>(initialNewUser);
  const [initialUserData, setInitialUserData] = useState<NewUser | undefined>(undefined);

  useSuccessTimer(success, setSuccess);

  const fetchUsers = useMemo(
    () =>
      createFetchDataHandler<User[]>(
        "/api/admin/users",
        setUsers,
        setError,
        setIsLoading,
        router
      ),
    [createFetchDataHandler, router]
  );

  useEffect(() => {
    if (status === "authenticated") {
      fetchUsers();
    }
  }, [status, fetchUsers]);

  const createUser = useMemo(
    () =>
      createFetchHandler<NewUser>(
        "/api/admin/users",
        "POST",
        setError,
        setIsCreatingUser,
        modalUserData
      ),
    [createFetchHandler, modalUserData]
  );

  const sendInvite = useMemo(
    () =>
      createFetchHandler<{ email: string }>(
        "/api/admin/invitations",
        "POST",
        setError,
        setIsSendingInvite,
        { email: inviteEmail }
      ),
    [createFetchHandler, inviteEmail]
  );

  const deleteUser = useMemo(
    () =>
      createFetchHandler(
        "/api/admin/users",
        "DELETE",
        setError,
        setIsCreatingUser
      ),
    [createFetchHandler]
  );

  const updateUser = useMemo(
    () =>
      createFetchHandler<NewUser>(
        "/api/admin/users",
        "PATCH",
        setError,
        setIsUpdatingUser,
        modalUserData
      ),
    [createFetchHandler, modalUserData]
  );

  const handleCreateUser = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createUser();
    if (result.success && result.data) {
      setSuccess(`Benutzer ${(result.data as { name: string }).name} wurde erfolgreich erstellt`);
      setIsModalOpen(false);
      setModalUserData(initialNewUser);
      setEditingUser(null);
      await fetchUsers();
    }
  }, [createUser, fetchUsers]);

  const handleSendInvite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await sendInvite();
    if (result.success) {
      setSuccess("Einladung wurde erfolgreich versendet");
      setInviteEmail("");
    }
  }, [sendInvite]);

  const handleDeleteUser = createDeleteHandler(
    deleteUser,
    setSuccess,
    "Benutzer wurde erfolgreich gelöscht",
    fetchUsers
  );

  const openCreateModal = useCallback(() => {
    setModalUserData(initialNewUser);
    setEditingUser(null);
    setError("");
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((user: User) => {
    setEditingUser(user);
    const userData = {
      email: user.email,
      name: user.name,
      address: user.address || "",
      phone: user.phone || "",
      role: user.role,
      memberSince: user.memberSince || "",
      dateOfBirth: user.dateOfBirth || "",
      rank: user.rank || "",
      pk: user.pk || "",
      hasPossessionCard: user.hasPossessionCard || false,
    };
    setModalUserData(userData);
    setInitialUserData(userData); // Track initial for unsaved changes
    setError("");
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setModalUserData(initialNewUser);
    setInitialUserData(undefined); // Clear initial user data
    setEditingUser(null);
    setError("");
  }, []);

  const handleUpdateUser = useCallback(async (e: React.FormEvent) => {
    if (!editingUser) return;

    e.preventDefault();

    const result = await updateUser(editingUser.id);
    if (result.success && result.data) {
      setSuccess(`Benutzer ${(result.data as { name: string }).name} wurde erfolgreich aktualisiert`);
      setIsModalOpen(false);
      setModalUserData(initialNewUser);
      setEditingUser(null);
      await fetchUsers();
    }
  }, [editingUser, updateUser, fetchUsers]);

  const startEditingUser = useCallback((user: User) => {
    openEditModal(user);
  }, [openEditModal]);

  const canDeleteUser = useCallback((userId: string): boolean => {
    const user = users.find((u) => u.id === userId);
    if (!user) return false;

    if (user.role !== "ADMIN") return true;

    const adminCount = users.filter((u) => u.role === "ADMIN").length;
    return adminCount > 1;
  }, [users]);

  return {
    users,
    isLoading,
    isCreatingUser,
    isUpdatingUser,
    isSendingInvite,
    error,
    success,
    inviteEmail,
    modalUserData,
    setModalUserData,
    initialUserData,
    isModalOpen,
    editingUser,
    setInviteEmail,
    handleCreateUser,
    handleUpdateUser,
    handleSendInvite,
    handleDeleteUser,
    startEditingUser,
    openCreateModal,
    openEditModal,
    closeModal,
    canDeleteUser,
  };
}

export type { User, NewUser };
