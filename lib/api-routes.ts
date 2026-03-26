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
  ADMIN: {
    EVENTS: "/api/admin/events",
    DOCUMENTS: "/api/admin/documents",
    DOCUMENT_DIRECTORIES: "/api/admin/document-directories",
  },
  MEMBER: {
    DOCUMENTS: "/api/member/documents",
    DOCUMENT_DIRECTORIES: "/api/member/document-directories",
  },
} as const;
