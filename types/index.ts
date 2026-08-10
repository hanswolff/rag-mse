import { Role } from "@prisma/client";

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
  visible: boolean;
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
  visible: boolean;
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
  createdAt: string;
  updatedAt?: string;
}

export interface NewAusschreibungInput {
  title: string;
  description: string;
  expiresAt: string;
  file: File | null;
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
