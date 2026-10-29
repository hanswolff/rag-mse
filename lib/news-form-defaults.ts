import type { NewNews } from "@/types";
import { getLocalDateString } from "@/lib/date-picker-utils";

// Einzige Quelle für das leere News-Formular. Sie stand zuvor wortgleich in
// components/news-form-modal.tsx, lib/use-news-management.ts und
// app/admin/news/[id]/edit/page.tsx.
export const EMPTY_NEWS_FORM: NewNews = {
  newsDate: getLocalDateString(),
  title: "",
  content: "",
  published: true,
};
