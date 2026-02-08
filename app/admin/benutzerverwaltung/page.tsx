"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";
import { useUserManagement } from "@/lib/use-user-management";
import { formatDate } from "@/lib/date-utils";
import { UserFormModal } from "@/components/user-form-modal";
import { BackLink } from "@/components/back-link";
import type { User } from "@/types";

function InviteForm({ email, setEmail, onSubmit, isSubmitting }: { email: string; setEmail: (value: string) => void; onSubmit: (e: React.FormEvent) => void; isSubmitting: boolean }) {
  return (
    <div className="card-compact">
      <h2 className="text-lg sm:text-xl font-semibold mb-2">Einladung versenden</h2>
      <p className="text-base text-gray-600 mb-4">
        Mitglieder können sich über einen Einladungslink selbst registrieren.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="inviteEmail" className="form-label">E-Mail *</label>
          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-input"
            placeholder="beispiel@email.de"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
        >
          {isSubmitting ? "Wird versendet..." : "Einladung senden"}
        </button>
      </form>
    </div>
  );
}

function UserList({ users, onEdit, onDelete, canDeleteUser }: { users: User[]; onEdit: (u: User) => void; onDelete: (id: string) => void; canDeleteUser: (id: string) => boolean }) {
  if (users.length === 0) return <p className="text-gray-500">Keine Benutzer gefunden</p>;
  return (
    <div className="space-y-3">
      {users.map((user) => {
        const canDelete = canDeleteUser(user.id);
        return (
          <div key={user.id} className="border border-gray-200 rounded-md p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-gray-900">{user.name}</h3>
                  <span
                    className={`px-2 py-1 text-base font-medium rounded ${
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-brand-blue-50 text-brand-blue-800"
                    }`}
                  >
                    {user.role === "ADMIN" ? "Admin" : "Mitglied"}
                  </span>
                </div>
                <p className="text-base text-gray-600">{user.email}</p>
                {user.address && <p className="text-base text-gray-500">{user.address}</p>}
                {user.phone && <p className="text-base text-gray-500">{user.phone}</p>}
                <p className="text-base text-gray-400 mt-1">
                  Erstellt: {formatDate(user.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onEdit(user)}
                  className="px-3 py-2 text-base bg-brand-blue-50 text-brand-blue-800 rounded hover:bg-brand-blue-100 focus:outline-none focus:ring-2 focus:ring-brand-red-600/30 touch-manipulation"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => onDelete(user.id)}
                  disabled={!canDelete}
                  title={!canDelete ? "Der letzte Administrator darf nicht gelöscht werden" : undefined}
                  className={`px-3 py-2 text-base rounded focus:outline-none focus:ring-2 focus:ring-red-500 touch-manipulation ${
                    canDelete
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BenutzerverwaltungPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userManagement = useUserManagement();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router]);

  if (status === "loading" || userManagement.isLoading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="mb-8 space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
            <div className="h-10 bg-gray-200 rounded w-1/2 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="h-32 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Benutzerverwaltung</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Verwalten Sie Benutzerkonten und senden Sie Einladungen</p>
        </div>

        {userManagement.error && (
          <div
            role="alert"
            aria-live="assertive"
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          >
            {userManagement.error}
          </div>
        )}

        {userManagement.success && (
          <div
            role="status"
            aria-live="polite"
            className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4"
          >
            {userManagement.success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="card-compact">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Benutzer hinzufügen</h2>
              <p className="text-base text-gray-600 mb-4">
                Erstellen Sie neue Benutzerkonten oder bearbeiten Sie vorhandene.
              </p>
              <button
                onClick={userManagement.openCreateModal}
                className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
              >
                Neuen Benutzer erstellen
              </button>
            </div>
            <InviteForm
              email={userManagement.inviteEmail}
              setEmail={userManagement.setInviteEmail}
              onSubmit={userManagement.handleSendInvite}
              isSubmitting={userManagement.isSendingInvite}
            />
          </div>
          <div className="card-compact">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Benutzerliste</h2>
            {userManagement.users.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <p className="text-gray-500 mb-4">Noch keine Benutzer vorhanden</p>
                <button
                  onClick={userManagement.openCreateModal}
                  className="btn-primary"
                >
                  Ersten Benutzer erstellen
                </button>
              </div>
            ) : (
              <UserList
                users={userManagement.users}
                onEdit={userManagement.startEditingUser}
                onDelete={userManagement.handleDeleteUser}
                canDeleteUser={userManagement.canDeleteUser}
              />
            )}
          </div>
        </div>

        <UserFormModal
          isOpen={userManagement.isModalOpen}
          onClose={userManagement.closeModal}
          onSubmit={userManagement.editingUser ? userManagement.handleUpdateUser : userManagement.handleCreateUser}
          isSubmitting={userManagement.isCreatingUser || userManagement.isUpdatingUser}
          userData={userManagement.modalUserData}
          setUserData={userManagement.setModalUserData}
          isEditing={!!userManagement.editingUser}
          errors={userManagement.error ? { general: userManagement.error } : {}}
          initialUserData={userManagement.initialUserData}
        />
      </div>
    </main>
  );
}
