"use client";

import { AdminDocumentManager } from "@/components/admin-document-manager";

export default function AdminDocumentsPage() {
  return (
    <AdminDocumentManager
      area="ADMIN"
      title="Admin-Dokumente verwalten"
      listTitle="Admin-Dokumente"
      description="Admin-Dokumente hochladen, durchsuchen, ansehen und verwalten"
    />
  );
}
