/**
 * Shared test factories for common mock objects.
 * Each factory returns a complete object with sensible defaults.
 * Pass partial overrides to customise individual fields.
 */

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface MockUser {
  id: string;
  email: string;
  password: string;
  name: string | null;
  role: string;
  address: string | null;
  phone: string | null;
  memberSince: Date | null;
  dateOfBirth: Date | null;
  rank: string | null;
  pk: string | null;
  reservistsAssociation: string | null;
  associationMemberNumber: string | null;
  hasPossessionCard: boolean;
  eventReminderEnabled: boolean;
  eventReminderDaysBefore: number;
  pollNotificationEnabled: boolean;
  adminNotes: string | null;
  lastLoginAt: Date | null;
  passwordUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function buildUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "test@example.com",
    password: "hashed-password",
    name: "Test User",
    role: "MEMBER",
    address: null,
    phone: null,
    memberSince: null,
    dateOfBirth: null,
    rank: null,
    pk: null,
    reservistsAssociation: null,
    associationMemberNumber: null,
    hasPossessionCard: false,
    eventReminderEnabled: true,
    eventReminderDaysBefore: 7,
    pollNotificationEnabled: true,
    adminNotes: null,
    lastLoginAt: null,
    passwordUpdatedAt: null,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function buildAdmin(overrides: Partial<MockUser> = {}): MockUser {
  return buildUser({
    id: "admin-1",
    email: "admin@example.com",
    name: "Admin User",
    role: "ADMIN",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export interface MockEvent {
  id: string;
  date: Date;
  timeFrom: string;
  timeTo: string;
  location: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  type: string | null;
  visible: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { votes: number };
  votes?: MockVote[];
  guestRegistrations?: MockGuestRegistration[];
}

export function buildEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    id: "event-1",
    date: new Date("2026-04-15"),
    timeFrom: "18:00",
    timeTo: "20:00",
    location: "Schießstand A",
    description: "Training",
    latitude: 50.0,
    longitude: 10.0,
    type: "TRAINING",
    visible: true,
    createdById: "admin-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Vote
// ---------------------------------------------------------------------------

export interface MockVote {
  id: string;
  userId: string;
  eventId: string;
  vote: string;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string | null };
}

export function buildVote(overrides: Partial<MockVote> = {}): MockVote {
  return {
    id: "vote-1",
    userId: "user-1",
    eventId: "event-1",
    vote: "JA",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GuestRegistration
// ---------------------------------------------------------------------------

export interface MockGuestRegistration {
  id: string;
  eventId: string;
  name: string;
  vote: string;
  createdAt: Date;
  updatedAt: Date;
}

export function buildGuestRegistration(
  overrides: Partial<MockGuestRegistration> = {},
): MockGuestRegistration {
  return {
    id: "guest-1",
    eventId: "event-1",
    name: "Gast 1",
    vote: "VIELLEICHT",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export interface MockNews {
  id: string;
  title: string;
  content: string;
  newsDate: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export function buildNews(overrides: Partial<MockNews> = {}): MockNews {
  return {
    id: "news-1",
    title: "Test News",
    content: "Test content",
    newsDate: "2024-01-01",
    published: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Session (next-auth)
// ---------------------------------------------------------------------------

export interface MockSessionUser {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
  isImpersonating?: boolean;
  impersonatedBy?: { id: string; email: string; name: string | null } | null;
}

export interface MockSession {
  user: MockSessionUser;
  expires: string;
  impersonationStartProof?: string;
  impersonationStopProof?: string;
}

export function buildSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    user: {
      id: "user-1",
      role: "MEMBER",
      name: "Test User",
      email: "test@example.com",
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

export function buildAdminSession(overrides: Partial<MockSession> = {}): MockSession {
  return buildSession({
    user: {
      id: "admin-1",
      role: "ADMIN",
      name: "Admin User",
      email: "admin@example.com",
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

export interface MockInvitation {
  id: string;
  email: string;
  tokenHash: string;
  role: string;
  expiresAt: Date;
  usedAt: Date | null;
  invitedById: string | null;
  invitedBy?: { email: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export function buildInvitation(overrides: Partial<MockInvitation> = {}): MockInvitation {
  return {
    id: "inv-1",
    email: "invited@example.com",
    tokenHash: "mock-token-hash",
    role: "MEMBER",
    expiresAt: new Date("2099-12-31T23:59:59Z"),
    usedAt: null,
    invitedById: "admin-1",
    invitedBy: { email: "admin@example.com" },
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ShootingRange
// ---------------------------------------------------------------------------

export interface MockShootingRange {
  id: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  createdAt: Date;
  updatedAt: Date;
}

export function buildShootingRange(
  overrides: Partial<MockShootingRange> = {},
): MockShootingRange {
  return {
    id: "range-1",
    name: "Schießstand Test",
    street: "Teststraße 1",
    postalCode: "12345",
    city: "Teststadt",
    latitude: 53.5,
    longitude: 13.2,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Poll + PollOption + PollVote
// ---------------------------------------------------------------------------

export interface MockPollOption {
  id: string;
  pollId: string;
  text: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: { votes: number };
}

export interface MockPollVote {
  id: string;
  pollId: string;
  optionId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockPoll {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  multipleChoice: boolean;
  shortCode: string | null;
  eventId: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  options?: MockPollOption[];
  votes?: Array<{ optionId: string }>;
  event?: { id: string; date: Date; description: string } | null;
  _count?: { votes: number };
}

export function buildPollOption(overrides: Partial<MockPollOption> = {}): MockPollOption {
  return {
    id: "opt-1",
    pollId: "poll-1",
    text: "Ja",
    position: 0,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    _count: { votes: 0 },
    ...overrides,
  };
}

export function buildPoll(overrides: Partial<MockPoll> = {}): MockPoll {
  return {
    id: "poll-1",
    title: "Test Poll",
    description: null,
    type: "SONSTIGES",
    status: "LIVE",
    multipleChoice: false,
    shortCode: null,
    eventId: null,
    createdById: "admin-1",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    options: [
      buildPollOption({ id: "opt-1", text: "Ja", position: 0, _count: { votes: 1 } }),
      buildPollOption({ id: "opt-2", text: "Nein", position: 1, _count: { votes: 0 } }),
    ],
    votes: [],
    event: null,
    _count: { votes: 1 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Document + DocumentDirectory
// ---------------------------------------------------------------------------

export interface MockDocumentDirectory {
  id: string;
  name: string;
  nameNormalized: string;
  area: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockDocument {
  id: string;
  displayName: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  documentDate: Date;
  area: string;
  directoryId: string | null;
  directory?: { id: string; name: string } | null;
  uploadedById: string | null;
  uploadedBy?: { id: string; name: string | null; email: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export function buildDocumentDirectory(
  overrides: Partial<MockDocumentDirectory> = {},
): MockDocumentDirectory {
  return {
    id: "dir-1",
    name: "Anträge",
    nameNormalized: "anträge",
    area: "ADMIN",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function buildDocument(overrides: Partial<MockDocument> = {}): MockDocument {
  return {
    id: "doc-1",
    displayName: "Antrag 1",
    originalFileName: "antrag.pdf",
    storedFileName: "abc123.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    documentDate: new Date("2026-02-10T00:00:00Z"),
    area: "ADMIN",
    directoryId: null,
    directory: null,
    uploadedById: "admin-1",
    uploadedBy: { id: "admin-1", name: "Admin", email: "admin@example.com" },
    createdAt: new Date("2026-02-10T10:00:00Z"),
    updatedAt: new Date("2026-02-10T10:00:00Z"),
    ...overrides,
  };
}
