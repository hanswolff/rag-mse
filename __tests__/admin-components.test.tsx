import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminPage from "../app/admin/page";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({ data: { user: { role: "ADMIN" } }, status: "authenticated" })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading state", () => {
    it("shows loading state when status is loading", () => {
      (useSession as jest.Mock).mockReturnValueOnce({ data: null, status: "loading" });

      render(<AdminPage />);
      expect(screen.getByText("Laden...")).toBeInTheDocument();
    });
  });

  describe("Redirect behavior", () => {
    it("redirects to admin/dashboard when authenticated as admin", () => {
      const pushMock = jest.fn();
      (useRouter as jest.Mock).mockReturnValueOnce({ push: pushMock });

      render(<AdminPage />);

      expect(pushMock).toHaveBeenCalledWith("/admin/dashboard");
    });
  });

  describe("Empty render", () => {
    it("returns null when not loading and not redirecting", () => {
      const { container } = render(<AdminPage />);
      expect(container.firstChild).toBeNull();
    });
  });
});
