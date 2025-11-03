import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  emailIsAllowlisted,
  metadataDeclaresAdmin,
  planGrantsAdmin,
  isAdminUser,
  shouldElevateToAdmin,
} from "../auth/admin";

// Mock the env module
vi.mock("../env", () => ({
  env: {
    LEXYHUB_ADMIN_EMAILS: "admin@example.com, super@test.com",
  },
}));

describe("Admin Authorization", () => {
  describe("emailIsAllowlisted", () => {
    it("returns true for allowlisted emails", () => {
      expect(emailIsAllowlisted("admin@example.com")).toBe(true);
      expect(emailIsAllowlisted("super@test.com")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(emailIsAllowlisted("ADMIN@EXAMPLE.COM")).toBe(true);
      expect(emailIsAllowlisted("Super@Test.com")).toBe(true);
    });

    it("trims whitespace", () => {
      expect(emailIsAllowlisted(" admin@example.com ")).toBe(true);
    });

    it("returns false for non-allowlisted emails", () => {
      expect(emailIsAllowlisted("user@example.com")).toBe(false);
      expect(emailIsAllowlisted("hacker@evil.com")).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(emailIsAllowlisted(null)).toBe(false);
      expect(emailIsAllowlisted(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(emailIsAllowlisted("")).toBe(false);
    });
  });

  describe("metadataDeclaresAdmin", () => {
    it("detects admin in app_metadata.admin", () => {
      const user = {
        id: "1",
        app_metadata: { admin: true },
      } as User;
      expect(metadataDeclaresAdmin(user)).toBe(true);
    });

    it("detects admin in app_metadata.role", () => {
      const user = {
        id: "1",
        app_metadata: { role: "admin" },
      } as User;
      expect(metadataDeclaresAdmin(user)).toBe(true);
    });

    it("detects admin in app_metadata.roles array", () => {
      const user = {
        id: "1",
        app_metadata: { roles: ["user", "admin"] },
      } as User;
      expect(metadataDeclaresAdmin(user)).toBe(true);
    });

    it("detects admin in user_metadata", () => {
      const user = {
        id: "1",
        app_metadata: {},
        user_metadata: { admin: true },
      } as User;
      expect(metadataDeclaresAdmin(user)).toBe(true);
    });

    it("returns false for non-admin users", () => {
      const user = {
        id: "1",
        app_metadata: { role: "user" },
        user_metadata: {},
      } as User;
      expect(metadataDeclaresAdmin(user)).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(metadataDeclaresAdmin(null)).toBe(false);
      expect(metadataDeclaresAdmin(undefined)).toBe(false);
    });

    it("handles various admin role strings", () => {
      expect(
        metadataDeclaresAdmin({ id: "1", app_metadata: { role: "administrator" } } as User),
      ).toBe(true);
      expect(metadataDeclaresAdmin({ id: "1", app_metadata: { role: "ADMIN" } } as User)).toBe(
        true,
      );
    });
  });

  describe("planGrantsAdmin", () => {
    it("returns true for admin plan", () => {
      expect(planGrantsAdmin("admin")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(planGrantsAdmin("ADMIN")).toBe(true);
      expect(planGrantsAdmin("Admin")).toBe(true);
    });

    it("returns false for non-admin plans", () => {
      expect(planGrantsAdmin("free")).toBe(false);
      expect(planGrantsAdmin("growth")).toBe(false);
      expect(planGrantsAdmin("scale")).toBe(false);
    });

    it("returns false for null or undefined", () => {
      expect(planGrantsAdmin(null)).toBe(false);
      expect(planGrantsAdmin(undefined)).toBe(false);
    });
  });

  describe("isAdminUser", () => {
    it("returns true for allowlisted email", () => {
      const user = {
        id: "1",
        email: "admin@example.com",
        app_metadata: {},
      } as User;
      expect(isAdminUser(user, null)).toBe(true);
    });

    it("returns true for metadata declaring admin", () => {
      const user = {
        id: "1",
        email: "user@example.com",
        app_metadata: { admin: true },
      } as User;
      expect(isAdminUser(user, null)).toBe(true);
    });

    it("returns true for admin plan", () => {
      const user = {
        id: "1",
        email: "user@example.com",
        app_metadata: {},
      } as User;
      expect(isAdminUser(user, "admin")).toBe(true);
    });

    it("returns false when none of the conditions match", () => {
      const user = {
        id: "1",
        email: "user@example.com",
        app_metadata: {},
      } as User;
      expect(isAdminUser(user, "free")).toBe(false);
    });

    it("returns false for null user", () => {
      expect(isAdminUser(null, "admin")).toBe(false);
      expect(isAdminUser(undefined, "admin")).toBe(false);
    });
  });

  describe("shouldElevateToAdmin", () => {
    it("elevates allowlisted email", () => {
      const user = {
        id: "1",
        email: "admin@example.com",
        app_metadata: {},
      } as User;
      expect(shouldElevateToAdmin(user, null)).toBe(true);
    });

    it("elevates metadata admin", () => {
      const user = {
        id: "1",
        email: "user@example.com",
        app_metadata: { admin: true },
      } as User;
      expect(shouldElevateToAdmin(user, null)).toBe(true);
    });

    it("elevates admin plan", () => {
      const user = {
        id: "1",
        email: "user@example.com",
        app_metadata: {},
      } as User;
      expect(shouldElevateToAdmin(user, "admin")).toBe(true);
    });

    it("does not elevate regular users", () => {
      const user = {
        id: "1",
        email: "user@example.com",
        app_metadata: {},
      } as User;
      expect(shouldElevateToAdmin(user, "free")).toBe(false);
    });
  });
});
