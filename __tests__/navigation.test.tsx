import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession, signOut } from "next-auth/react";
import { Navigation } from "@/components/navigation";

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
    expect(screen.getAllByText("Abmelden").length).toBeGreaterThan(0);
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
    expect(screen.getAllByText("Abmelden").length).toBeGreaterThan(0);
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
});
