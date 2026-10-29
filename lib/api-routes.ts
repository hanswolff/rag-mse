export const API_ROUTES = {
  AUTH: {
    LOGIN: "/api/auth/login",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    IMPERSONATION_STOP: "/api/auth/impersonation/stop",
  },
  USER: {
    PROFILE: "/api/user/profile",
    CHANGE_PASSWORD: "/api/user/change-password",
    NOTIFICATIONS: "/api/user/notifications",
  },
  CONTACT: "/api/contact",
  RANGES: "/api/ranges",
  POLLS: "/api/polls",
  AUSSCHREIBUNGEN: "/api/ausschreibungen",
  ABSENCES: "/api/abwesenheiten",
  CALENDAR: "/api/kalender",
  ADMIN: {
    EVENTS: "/api/admin/events",
    DOCUMENTS: "/api/admin/documents",
    DOCUMENT_DIRECTORIES: "/api/admin/document-directories",
    AUSSCHREIBUNGEN: "/api/admin/ausschreibungen",
    EXTERNAL_EVENTS: "/api/admin/fremdtermine",
    COLLISIONS: "/api/admin/kollisionen",
  },
  MEMBER: {
    DOCUMENTS: "/api/member/documents",
    DOCUMENT_DIRECTORIES: "/api/member/document-directories",
  },
} as const;
