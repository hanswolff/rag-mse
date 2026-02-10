import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ProfilePage from "@/app/profil/page";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("next/navigation");

describe("ProfilePage", () => {
  const mockPush = jest.fn();
  const mockUpdate = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockPush.mockClear();
    mockUpdate.mockClear();
    mockUpdate.mockResolvedValue(true);
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it("should redirect to login if unauthenticated", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: mockUpdate,
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login?returnUrl=%2F");
    });
  });

  it("should show loading state while fetching profile", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "1", role: "MEMBER" } },
      status: "authenticated",
      update: mockUpdate,
    });

    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: () => Promise.resolve({}),
          } as Response);
        }, 100);
      })
    );

    render(<ProfilePage />);

    expect(screen.getByText("Laden...")).toBeInTheDocument();
  });

  it("should display profile form when data is loaded", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "1", role: "MEMBER" } },
      status: "authenticated",
      update: mockUpdate,
    });

    const mockProfile = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      address: "Test Street 123",
      phone: "+49 123 456789",
      role: "MEMBER",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    } as Response);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Mein Profil")).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/adresse/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/telefon/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/reservistenkameradschaft/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/mitgliedsnummer im verband/i)).toBeInTheDocument();
    });
  });

  it("should populate form with user data", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "1", role: "MEMBER" } },
      status: "authenticated",
      update: mockUpdate,
    });

    const mockProfile = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      address: "Test Address",
      phone: "+49 123 456789",
      role: "MEMBER",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    } as Response);

    render(<ProfilePage />);

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toHaveValue("Test User");

      const emailInput = screen.getByLabelText(/e-mail/i);
      expect(emailInput).toHaveValue("test@example.com");
    });
  });

  it("should show role information", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "1", role: "MEMBER" } },
      status: "authenticated",
      update: mockUpdate,
    });

    const mockProfile = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      address: null,
      phone: null,
      role: "MEMBER",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    } as Response);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Mitglied")).toBeInTheDocument();
    });
  });

  it("should show admin role correctly", async () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "1", role: "ADMIN" } },
      status: "authenticated",
      update: mockUpdate,
    });

    const mockProfile = {
      id: "1",
      email: "admin@example.com",
      name: "Admin User",
      address: null,
      phone: null,
      role: "ADMIN",
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    } as Response);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Administrator")).toBeInTheDocument();
    });
  });

  it("should update session when profile name is changed", async () => {
    const user = userEvent.setup();

    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: "1", role: "MEMBER" } },
      status: "authenticated",
      update: mockUpdate,
    });

    const mockProfile = {
      id: "1",
      email: "test@example.com",
      name: "Test User",
      address: "Test Street 123",
      phone: "+49 123 456789",
      role: "MEMBER",
    };

    const updatedProfile = {
      ...mockProfile,
      name: "New Name",
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(updatedProfile),
      } as Response);

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");

    const saveButton = screen.getByRole("button", { name: /speichern/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ name: "New Name" });
    });
  });
});
