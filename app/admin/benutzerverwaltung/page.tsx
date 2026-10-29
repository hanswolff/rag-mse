"use client";

import { useSession } from "next-auth/react";
import { canManageAdminArea } from "@/lib/role-utils";
import { useImpersonation } from "@/lib/use-impersonation";
import { useUserManagement } from "@/lib/use-user-management";
import { formatDate } from "@/lib/date-utils";
import { UserFormModal } from "@/components/user-form-modal";
import { LoadingButton } from "@/components/loading-button";
import { BackLink } from "@/components/back-link";
import { Permissions } from "@/lib/permissions";
import { PencilIcon, TrashIcon, UserIcon, UsersIcon, MailIcon } from "@/components/icons";
import type { User } from "@/types";
import { AlertBox } from "@/components/alert-box";

function InviteForm({
  email,
  setEmail,
  onSubmit,
  isSubmitting,
  error,
}: {
  email: string;
  setEmail: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  error?: string;
}) {
  return (
    <div className="card-compact">
      <h2 className="text-lg sm:text-xl font-semibold mb-2">Einladung versenden</h2>
      <p className="text-base text-gray-600 mb-4">
        Mitglieder legen ihr Benutzerkonto über einen Einladungslink selbst an.
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
            className={`form-input ${error ? "border-red-500 focus:border-red-500" : ""}`}
            placeholder="beispiel@email.de"
            disabled={isSubmitting}
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "invite-email-error" : undefined}
          />
          {error && (
            <p id="invite-email-error" className="form-help text-red-600">
              {error}
            </p>
          )}
        </div>
        <LoadingButton
          type="submit"
          loading={isSubmitting}
          loadingText="Wird versendet…"
          className="w-full btn-primary py-2.5 sm:py-2 text-base sm:text-base touch-manipulation"
        >
          Einladung senden
        </LoadingButton>
      </form>
    </div>
  );
}

function UserList({
  users,
  onEdit,
  onDelete,
  canDeleteUser,
  canManage,
  canEditSiteAdministrator,
  canImpersonateUser,
  onImpersonate,
  impersonatingUserId,
  onResendInvitation,
  resendingInvitationEmail,
}: {
  users: User[];
  onEdit: (u: User) => void;
  onDelete: (id: string) => void;
  canDeleteUser: (id: string) => boolean;
  canManage: boolean;
  canEditSiteAdministrator: boolean;
  canImpersonateUser: (u: User) => boolean;
  onImpersonate: (u: User) => Promise<void>;
  impersonatingUserId: string | null;
  onResendInvitation: (email: string) => Promise<void>;
  resendingInvitationEmail: string | null;
}) {
  if (users.length === 0) return <p className="text-gray-500">Keine Benutzer gefunden</p>;
  return (
    <div className="space-y-2.5">
      {users.map((user) => {
        const canDelete = canDeleteUser(user.id);
        const canEdit = user.role !== "SITE_ADMINISTRATOR" || canEditSiteAdministrator;
        return (
          <article key={user.id} className="rounded-md border border-gray-200 bg-gray-50/40 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-gray-900">{user.name}</h3>
                  <span
                    className={`px-2 py-1 text-base font-medium rounded ${
                      user.role === "SITE_ADMINISTRATOR"
                        ? "bg-amber-100 text-amber-800"
                        : user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-800"
                        : user.role === "AUDITOR"
                          ? "bg-slate-100 text-slate-800"
                        : "bg-brand-blue-50 text-brand-blue-800"
                    }`}
                  >
                    {Permissions.getRoleLabel(user.role)}
                  </span>
                </div>
                <p className="text-base text-gray-700 truncate">{user.email}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  {user.address && <p className="truncate">{user.address}</p>}
                  {user.phone && <p>{user.phone}</p>}
                </div>
              </div>
              {canManage && (
                <div className="flex items-start gap-1.5 sm:justify-end">
                  {canImpersonateUser(user) && (
                    <button
                      onClick={() => void onImpersonate(user)}
                      disabled={impersonatingUserId !== null}
                      aria-label={`Als Benutzer einloggen: ${user.name}`}
                      title={`Als Benutzer einloggen: ${user.name}`}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-brand-red-600/30 ${
                        impersonatingUserId === null
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <UserIcon className="h-4 w-4" />
                    </button>
                  )}
                  {!user.activatedAt && (
                    <button
                      onClick={() => void onResendInvitation(user.email)}
                      disabled={resendingInvitationEmail !== null}
                      aria-label={`Einladung erneut senden: ${user.name}`}
                      title="Einladung erneut senden"
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-brand-red-600/30 ${
                        resendingInvitationEmail === null
                          ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <MailIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(user)}
                    disabled={!canEdit}
                    aria-label={`Benutzer bearbeiten: ${user.name}`}
                    title={!canEdit ? "Der Site-Administrator kann nur vom Site-Administrator bearbeitet werden" : `Benutzer bearbeiten: ${user.name}`}
                    className="btn-icon"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(user.id)}
                    disabled={!canDelete}
                    aria-label={`Benutzer löschen: ${user.name}`}
                    title={!canDelete ? "Benutzer kann nicht gelöscht werden" : `Benutzer löschen: ${user.name}`}
                    className="btn-icon-danger"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 border-t border-gray-200 pt-2 text-xs sm:text-sm text-gray-500 break-words">
              <p className="leading-relaxed">
                Erstellt: {formatDate(user.createdAt)} &bull; Letzter Login: {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Nie"} &bull; {user.activatedAt ? `Aktiviert: ${formatDate(user.activatedAt)}` : "Noch nicht aktiviert"}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function BenutzerverwaltungPage() {
  const { data: session, status } = useSession();
  const userManagement = useUserManagement();
  const { impersonationError, impersonatingUserId, canImpersonateUser, handleImpersonate } = useImpersonation();
  const canManage = session ? canManageAdminArea(session.user) : false;
  const canEditSiteAdministrator = session ? Permissions.isSiteAdministrator(session.user) : false;

  if (status === "loading" || userManagement.isLoading) {
    return (
      <main className="flex-1 bg-gray-50">
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
    <main className="flex-1 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <BackLink href="/admin/dashboard" className="text-base">
            Zurück zum Dashboard
          </BackLink>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-4">Benutzerverwaltung</h1>
          <p className="text-base sm:text-base text-gray-600 mt-2">Verwalten Sie Benutzerkonten und senden Sie Einladungen</p>
        </div>

        <AlertBox type="error" message={userManagement.error} className="mb-4" />
        <AlertBox type="error" message={impersonationError} className="mb-4" />

        <AlertBox type="success" message={userManagement.success} className="mb-4" />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(20rem,1fr)_minmax(0,2fr)] gap-6 lg:gap-8">
          <div className="space-y-6">
            {canManage && (
              <>
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
                  error={userManagement.inviteError}
                />
              </>
            )}
          </div>
          <div className="card-compact">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Benutzerliste</h2>
            {userManagement.users.length === 0 ? (
              <div className="text-center py-12">
                <UsersIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Noch keine Benutzer vorhanden</p>
                {canManage && (
                  <button
                    onClick={userManagement.openCreateModal}
                    className="btn-primary"
                  >
                    Ersten Benutzer erstellen
                  </button>
                )}
              </div>
            ) : (
            <UserList
                users={userManagement.users}
                onEdit={userManagement.startEditingUser}
                onDelete={userManagement.handleDeleteUser}
                canDeleteUser={userManagement.canDeleteUser}
                canManage={canManage}
                canEditSiteAdministrator={canEditSiteAdministrator}
                canImpersonateUser={canImpersonateUser}
                onImpersonate={handleImpersonate}
                impersonatingUserId={impersonatingUserId}
                onResendInvitation={userManagement.handleResendInvitation}
                resendingInvitationEmail={userManagement.isResendingInvite}
              />
            )}
          </div>
        </div>

        {canManage && (
          <UserFormModal
            isOpen={userManagement.isModalOpen}
            onClose={userManagement.closeModal}
            onSubmit={userManagement.editingUser ? userManagement.handleUpdateUser : userManagement.handleCreateUser}
            isSubmitting={userManagement.isCreatingUser || userManagement.isUpdatingUser}
            userData={userManagement.modalUserData}
            setUserData={userManagement.setModalUserData}
            isEditing={!!userManagement.editingUser}
            errors={userManagement.error ? { general: userManagement.error } : {}}
            fieldErrors={userManagement.fieldErrors}
            initialUserData={userManagement.initialUserData}
          />
        )}
      </div>
    </main>
  );
}
