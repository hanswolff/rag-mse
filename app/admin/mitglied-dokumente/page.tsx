"use client";

import { AdminDocumentManager } from "@/components/admin-document-manager";

export default function AdminMemberDocumentsPage() {
  return (
    <AdminDocumentManager
      area="MEMBER"
      title="Dokumente für Mitglieder verwalten"
      listTitle="Dokumente für Mitglieder"
      description="Dokumente für Mitglieder hochladen, durchsuchen, ansehen und verwalten"
    />
  );
}
