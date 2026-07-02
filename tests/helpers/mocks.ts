import { vi } from "vitest";
import { emptyScene } from "~/lib/scene";
import type { Membership } from "../../workers/api/repositories/memberships-repo";
import type { Organization } from "../../workers/api/repositories/organizations-repo";
import type { Presentation } from "../../workers/api/repositories/presentations-repo";
import type { Slide } from "../../workers/api/repositories/slides-repo";
import type { User } from "../../workers/api/repositories/users-repo";

export function fakeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org_test_1",
    name: "Test Org",
    slug: "test-org",
    plan: "free",
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

export function mockOrganizationsRepo() {
  return {
    getById: vi.fn(),
    ensure: vi.fn(),
    updateFromClerk: vi.fn(),
    delete: vi.fn(),
  };
}

export function fakePresentation(
  overrides: Partial<Presentation> = {},
): Presentation {
  return {
    id: "pres_1",
    orgId: "org_test_1",
    title: "First Deck",
    createdBy: "user_test_1",
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

export function mockPresentationsRepo() {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByOrg: vi.fn(),
    countByOrg: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

export function mockPresentationsService() {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

export function fakeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: "slide_1",
    orgId: "org_test_1",
    presentationId: "pres_1",
    position: 0,
    scene: emptyScene(),
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

export function mockSlidesRepo() {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByPresentation: vi.fn(),
    countByPresentation: vi.fn(),
    updateScene: vi.fn(),
    updatePosition: vi.fn(),
    shiftPositionsAfter: vi.fn(),
    delete: vi.fn(),
  };
}

export function mockSlidesService() {
  return {
    list: vi.fn(),
    get: vi.fn(),
    add: vi.fn(),
    updateScene: vi.fn(),
    reorder: vi.fn(),
    duplicate: vi.fn(),
    delete: vi.fn(),
  };
}

export function mockUsageRepo() {
  return {
    getCount: vi.fn(),
    increment: vi.fn(),
    history: vi.fn(),
  };
}

export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user_test_1",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    imageUrl: null,
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

export function mockUsersRepo() {
  return {
    getById: vi.fn(),
    ensure: vi.fn(),
    upsert: vi.fn(),
    updateFromClerk: vi.fn(),
    delete: vi.fn(),
  };
}

export function fakeMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    orgId: "org_test_1",
    userId: "user_test_1",
    role: "org:member",
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

export function mockMembershipsRepo() {
  return {
    get: vi.fn(),
    upsert: vi.fn(),
    listByOrg: vi.fn(),
    reconcile: vi.fn(),
    remove: vi.fn(),
  };
}

export function mockUsersService() {
  return {
    ensureUser: vi.fn(),
    getById: vi.fn(),
    syncFromClerk: vi.fn(),
  };
}

export function mockMembersService() {
  return {
    ensureMembership: vi.fn(),
    listMembers: vi.fn(),
    removeMember: vi.fn(),
    syncFromClerk: vi.fn(),
  };
}
