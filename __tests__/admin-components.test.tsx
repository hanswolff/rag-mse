import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import AdminPage from "../app/admin/page";
import { useRouter } from "next/navigation";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Redirect behavior", () => {
    it("redirects to admin/dashboard", () => {
      const pushMock = jest.fn();
      (useRouter as jest.Mock).mockReturnValueOnce({ push: pushMock });

      render(<AdminPage />);

      expect(pushMock).toHaveBeenCalledWith("/admin/dashboard");
    });
  });

  describe("Render", () => {
    it("returns null", () => {
      const { container } = render(<AdminPage />);
      expect(container.firstChild).toBeNull();
    });
  });
});
