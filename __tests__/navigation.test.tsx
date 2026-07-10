import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession, signOut } from "next-auth/react";
import { Navigation } from "@/components/navigation";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
  })),
}));

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}));

const mockSession = {
  user: {
    id: "1",
    name: "Test User",
    email: "test@example.com",
    role: "MEMBER",
  },
  expires: "2024-01-01",
};

const mockAuditorSession = {
  user: {
    id: "2",
    name: "Audit User",
    email: "audit@example.com",
    role: "AUDITOR",
  },
  expires: "2024-01-01",
};

const mockImpersonatedSession = {
  user: {
    id: "3",
    name: "Vertretenes Mitglied",
    email: "member@example.com",
    role: "MEMBER",
    isImpersonating: true,
    impersonatedBy: {
      id: "site-1",
      role: "SITE_ADMINISTRATOR",
      name: "Site Admin",
      email: "site@example.com",
    },
  },
  expires: "2024-01-01",
};

describe("Navigation", () => {
  beforeEach(() => {
    (useSession as jest.Mock).mockReturnValue({ data: null, status: "unauthenticated" });
    (signOut as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  it("renders navigation with brand name", () => {
    render(<Navigation />);

    expect(screen.getByText("RAG Schießsport MSE")).toBeInTheDocument();
  });

  it("renders all navigation links", () => {
    render(<Navigation />);

    const links = screen.getAllByText("Startseite");
    expect(links.length).toBeGreaterThan(0);

    expect(screen.getAllByText("Über uns")).toHaveLength(links.length);
    // Infos appears twice: once in desktop nav (button) and once in mobile nav (button)
    expect(screen.getAllByText("Infos")).toHaveLength(links.length);
    expect(screen.getAllByText("Termine")).toHaveLength(links.length);
    expect(screen.getAllByText("Kontakt")).toHaveLength(links.length);
  });

  it("renders login button when not authenticated", () => {
    render(<Navigation />);

    expect(screen.getAllByText("Einloggen")).toHaveLength(2);
  });

  it("renders user menu when authenticated", () => {
    (useSession as jest.Mock).mockReturnValue({ data: mockSession, status: "authenticated" });
    render(<Navigation />);

    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    expect(screen.queryByText("Einloggen")).not.toBeInTheDocument();
  });

  it("opens user menu dropdown when user clicks on username", async () => {
    (useSession as jest.Mock).mockReturnValue({ data: mockSession, status: "authenticated" });
    const user = userEvent.setup();
    render(<Navigation />);

    const userButton = screen.getAllByText("Test User").find(el => el.tagName === "SPAN");
    expect(userButton).toBeInTheDocument();

    const button = userButton?.closest("button");
    expect(button).toBeInTheDocument();

    await user.click(button!);

    expect(screen.getAllByText("Profil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Benachrichtigungen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ausloggen").length).toBeGreaterThan(0);
  });

  it("opens the infos dropdown on desktop", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    // Find the desktop Infos button (has aria-haspopup)
    const infoButtons = screen.getAllByRole("button", { name: /Infos/i });
    const infoButton = infoButtons.find(btn => btn.hasAttribute("aria-haspopup"));
    expect(infoButton).toBeInTheDocument();
    const infoMenu = infoButton!.parentElement;
    expect(infoMenu).toBeInTheDocument();

    await user.click(infoButton!);

    expect(within(infoMenu as HTMLElement).getByText("Schießsportordnung")).toBeInTheDocument();
    expect(within(infoMenu as HTMLElement).getByText("Sicherheitsbelehrung")).toBeInTheDocument();
    expect(within(infoMenu as HTMLElement).queryByText("Dokumente für Mitglieder")).not.toBeInTheDocument();
  });

  it("shows member documents in the infos dropdown for authenticated members", async () => {
    (useSession as jest.Mock).mockReturnValue({ data: mockSession, status: "authenticated" });
    const user = userEvent.setup();
    render(<Navigation />);

    // Find the desktop Infos button (has aria-haspopup)
    const infoButtons = screen.getAllByRole("button", { name: /Infos/i });
    const infoButton = infoButtons.find(btn => btn.hasAttribute("aria-haspopup"));
    expect(infoButton).toBeInTheDocument();
    const infoMenu = infoButton!.parentElement;
    expect(infoMenu).toBeInTheDocument();

    await user.click(infoButton!);

    expect(within(infoMenu as HTMLElement).getByText("Dokumente für Mitglieder")).toBeInTheDocument();
  });

  it("closes the infos dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    // Find the desktop Infos button (has aria-haspopup)
    const infoButtons = screen.getAllByRole("button", { name: /Infos/i });
    const infoButton = infoButtons.find(btn => btn.hasAttribute("aria-haspopup"));
    expect(infoButton).toBeInTheDocument();
    const infoMenu = infoButton!.parentElement;
    expect(infoMenu).toBeInTheDocument();

    await user.click(infoButton!);
    expect(within(infoMenu as HTMLElement).getByText("Schießsportordnung")).toBeInTheDocument();

    await user.click(screen.getByRole("navigation"));

    expect(within(infoMenu as HTMLElement).queryByText("Schießsportordnung")).not.toBeInTheDocument();
  });

  it("closes user menu dropdown when clicking outside", async () => {
    (useSession as jest.Mock).mockReturnValue({ data: mockSession, status: "authenticated" });
    const user = userEvent.setup();
    render(<Navigation />);

    const userSpan = screen.getAllByText("Test User").find(el => el.tagName === "SPAN");
    const button = userSpan?.closest("button");
    await user.click(button!);

    const dropdown = screen.getByRole("navigation").querySelector(".absolute");
    expect(dropdown).toBeInTheDocument();

    const nav = screen.getByRole("navigation");
    await user.click(nav);

    const dropdownAfter = screen.getByRole("navigation").querySelector(".absolute");
    expect(dropdownAfter).toBeNull();
  });

  it("renders mobile menu button", () => {
    render(<Navigation />);

    const menuButton = screen.getAllByRole("button").find(btn =>
      btn.textContent?.includes("Menü öffnen")
    );
    expect(menuButton).toBeInTheDocument();
  });

  it("toggles mobile menu visibility", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const menuButton = screen.getAllByRole("button").find(btn =>
      btn.textContent?.includes("Menü öffnen")
    )!;

    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles mobile info section visibility", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    // Open mobile menu first
    const menuButton = screen.getAllByRole("button").find(btn =>
      btn.textContent?.includes("Menü öffnen")
    )!;
    await user.click(menuButton);

    const mobileMenu = screen.getByTestId("mobile-menu");

    // Find the mobile Infos button (does not have aria-haspopup)
    const infoButtons = within(mobileMenu).getAllByRole("button", { name: /Infos/i });
    const mobileInfoButton = infoButtons.find(btn => !btn.hasAttribute("aria-haspopup"));
    expect(mobileInfoButton).toBeInTheDocument();

    // Info items should not be visible initially
    expect(within(mobileMenu).queryByText("Schießsportordnung")).not.toBeInTheDocument();

    // Click to expand
    await user.click(mobileInfoButton!);

    // Now info items should be visible
    expect(within(mobileMenu).getByText("Schießsportordnung")).toBeInTheDocument();
    expect(within(mobileMenu).getByText("Sicherheitsbelehrung")).toBeInTheDocument();
  });

  it("shows login button in mobile menu when not authenticated", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const menuButton = screen.getAllByRole("button").find(btn =>
      btn.textContent?.includes("Menü öffnen")
    )!;
    await user.click(menuButton);

    const mobileMenu = screen.getByTestId("mobile-menu");
    const mobileLoginButtons = within(mobileMenu).getAllByText("Einloggen");
    expect(mobileLoginButtons.length).toBeGreaterThan(0);
  });

  it("shows user menu in mobile menu when authenticated", async () => {
    (useSession as jest.Mock).mockReturnValue({ data: mockSession, status: "authenticated" });
    const user = userEvent.setup();
    render(<Navigation />);

    const menuButton = screen.getAllByRole("button").find(btn =>
      btn.textContent?.includes("Menü öffnen")
    )!;
    await user.click(menuButton);

    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Profil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Benachrichtigungen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ausloggen").length).toBeGreaterThan(0);
  });

  it("shows member self-service links for auditor users", async () => {
    (useSession as jest.Mock).mockReturnValue({ data: mockAuditorSession, status: "authenticated" });
    const user = userEvent.setup();
    render(<Navigation />);

    const userButton = screen.getByRole("button", { name: /Audit User/i });
    await user.click(userButton);

    expect(screen.getAllByText("Profil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Benachrichtigungen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Passwort ändern").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Adminbereich").length).toBeGreaterThan(0);
  });

  it("renders navigation container", () => {
    render(<Navigation />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass("bg-white");
  });

  it("renders logo with alt text", () => {
    render(<Navigation />);

    const logo = screen.getByAltText("RAG Schießsport Logo");
    expect(logo).toBeInTheDocument();
  });

  it("shows impersonation banner when impersonation is active", () => {
    (useSession as jest.Mock).mockReturnValue({ data: mockImpersonatedSession, status: "authenticated", update: jest.fn() });
    render(<Navigation />);

    expect(screen.getByText(/Impersonierung aktiv/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Impersonierung beenden" })).toBeInTheDocument();
  });
});
