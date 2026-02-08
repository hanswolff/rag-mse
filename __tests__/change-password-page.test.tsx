import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChangePasswordPage from "@/app/passwort-aendern/page";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/components/password-change-form", () => ({
  PasswordChangeForm: ({ onSubmit }: { onSubmit: () => void }) => (
    <div>
      <p>mock-password-form</p>
      <button type="button" onClick={onSubmit}>
        Passwort absenden
      </button>
    </div>
  ),
}));

describe("ChangePasswordPage", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useSession as jest.Mock).mockReturnValue({
      status: "authenticated",
    });
  });

  it("shows password form for authenticated users", () => {
    render(<ChangePasswordPage />);

    expect(screen.getByText("mock-password-form")).toBeInTheDocument();
  });

  it("hides form and shows success message after successful password change", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Passwort wurde erfolgreich geändert" }),
    } as Response);

    render(<ChangePasswordPage />);

    fireEvent.click(screen.getByRole("button", { name: "Passwort absenden" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/user/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }),
      });
      expect(screen.getByText("Passwort wurde erfolgreich geändert")).toBeInTheDocument();
      expect(screen.queryByText("mock-password-form")).not.toBeInTheDocument();
    });
  });
});
