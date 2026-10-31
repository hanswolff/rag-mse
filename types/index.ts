import { ExternalEventKind, Visibility, Role, VoteType } from "@prisma/client";

// Domain models for the RAG Schießsport MSE application

/**
 * Represents an event in the system.
 * Used for both API responses and UI state.
 */
export interface Event {
  id: string;
  date: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  locationDisplay?: string;
  title: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  type: string | null;
  cost: string | null;
  capacity: number | null;
  visibility: Visibility;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    votes: number;
  };
  voteCounts?: {
    JA: number;
    NEIN: number;
    VIELLEICHT: number;
  };
}

/**
 * Represents a new event being created or edited.
 * Fields are strings for form input purposes.
 */
export interface NewEvent {
  date: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  title: string;
  description: string;
  latitude: string;
  longitude: string;
  type: string;
  cost: string;
  capacity: string;
  visibility: Visibility;
}

/**
 * Represents a news article.
 * Used for both API responses and UI state.
 */
export interface News {
  id: string;
  title: string;
  content: string;
  newsDate: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a new news article being created or edited.
 */
export interface NewNews {
  title: string;
  content: string;
  newsDate: string;
  published: boolean;
}

/**
 * Represents a user in the system.
 * Used for both API responses and UI state.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  address?: string | null;
  phone?: string | null;
  memberSince?: string | null;
  dateOfBirth?: string | null;
  rank?: string | null;
  pk?: string | null;
  reservistsAssociation?: string | null;
  associationMemberNumber?: string | null;
  hasPossessionCard?: boolean;
  adminNotes?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  passwordUpdatedAt?: string | null;
  activatedAt?: string | null;
}

/**
 * Represents a new user being created (with password).
 */
export interface NewUser {
  email: string;
  password?: string;
  name: string;
  address: string;
  phone: string;
  role: Role;
  memberSince: string;
  dateOfBirth: string;
  rank: string;
  pk: string;
  reservistsAssociation: string;
  associationMemberNumber: string;
  hasPossessionCard: boolean;
  adminNotes: string;
}


export interface DocumentItem {
  id: string;
  displayName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  documentDate: string;
  directoryId?: string | null;
  directory?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  uploadedById?: string | null;
  uploadedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface NewDocumentInput {
  displayName: string;
  documentDate: string;
  directoryId?: string | null;
  file: File | null;
}

export interface DocumentDirectoryItem {
  id: string;
  name: string;
  documentCount: number;
}

export interface AusschreibungItem {
  id: string;
  title: string;
  description: string | null;
  expiresAt: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: Visibility;
  createdAt: string;
  updatedAt?: string;
}

export interface NewAusschreibungInput {
  title: string;
  description: string;
  expiresAt: string;
  visibility: Visibility;
  file: File | null;
}

export interface ExternalEventItem {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  kind: ExternalEventKind | null;
  visibility: Visibility;
  ausschreibungId: string | null;
  ausschreibung: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalEventForm {
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string;
  timeTo: string;
  location: string;
  description: string;
  url: string;
  kind: ExternalEventKind | "";
  visibility: Visibility;
  ausschreibungId: string;
}

export const EMPTY_EXTERNAL_EVENT_FORM: ExternalEventForm = {
  title: "",
  startDate: "",
  endDate: "",
  allDay: true,
  timeFrom: "",
  timeTo: "",
  location: "",
  description: "",
  url: "",
  kind: "",
  visibility: Visibility.MEMBER,
  ausschreibungId: "",
};

export interface AbsenceItem {
  id: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string | null;
  timeTo: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AbsenceForm {
  startDate: string;
  endDate: string;
  allDay: boolean;
  timeFrom: string;
  timeTo: string;
  reason: string;
  userId?: string;
}

export interface AbsenceOwnerOption {
  id: string;
  name: string | null;
}

export const EMPTY_ABSENCE_FORM: AbsenceForm = {
  startDate: "",
  endDate: "",
  allDay: true,
  timeFrom: "",
  timeTo: "",
  reason: "",
};

/**
 * Represents a single answer option of a poll (Umfrage) with its vote count.
 * Used for both API responses and UI state.
 */
export interface PollOption {
  id: string;
  text: string;
  position: number;
  _count: { votes: number };
}

/**
 * Represents a poll (Umfrage) as returned by the member-facing polls API.
 * Used for both API responses and UI state (list, archive, and detail pages).
 */
export interface Poll {
  id: string;
  title: string;
  description: string | null;
  type: "TERMIN" | "SONSTIGES";
  status: "LIVE" | "CLOSED";
  multipleChoice: boolean;
  shortCode: string | null;
  options: PollOption[];
  _count: { votes: number };
  userVoteOptionIds: string[];
  event?: {
    id: string;
    date: string;
    timeFrom: string;
    timeTo: string;
    location: string;
    description: string;
  } | null;
}

export interface ShootingRangeItem {
  id: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewShootingRange {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  latitude: string;
  longitude: string;
}

export const EMPTY_SHOOTING_RANGE: NewShootingRange = {
  name: "",
  street: "",
  postalCode: "",
  city: "",
  latitude: "",
  longitude: "",
};

/**
 * Pagination metadata as returned by paginated list APIs.
 */
export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Generic paginated API response envelope.
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

/**
 * Per-user e-mail notification settings (member-facing settings page + API).
 */
export interface NotificationSettings {
  eventReminderEnabled: boolean;
  eventReminderDaysBefore: number;
  pollNotificationEnabled: boolean;
}

/**
 * Event details shown on the token-based RSVP page (Teilnahmeanmeldung per Link).
 */
export interface RsvpEvent {
  id: string;
  title: string | null;
  date: string;
  timeFrom: string;
  timeTo: string;
  location: string;
  description: string;
}

/**
 * Response of the token-based RSVP API (/api/notifications/rsvp/[token]).
 */
export interface RsvpData {
  event: RsvpEvent;
  user: {
    name: string | null;
  };
  currentVote: {
    id: string;
    vote: VoteType;
  } | null;
}
