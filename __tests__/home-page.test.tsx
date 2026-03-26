import { render, screen } from "@testing-library/react";
import Home from "@/app/page";
import { prisma } from "@/lib/prisma";
import { access } from "node:fs/promises";
import { getServerSession } from "next-auth";

jest.mock("next/cache", () => ({
  unstable_noStore: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("node:fs/promises", () => ({
  access: jest.fn(),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);
    (access as jest.Mock).mockRejectedValue(new Error("not found"));
    (getServerSession as jest.Mock).mockResolvedValue(null);
  });

  it("renders hero section with title and description", async () => {
    render(await Home());

    expect(
      screen.getByText("RAG Schießsport MSE")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reservistenarbeitsgemeinschaft für sportliches Schießen in der Mecklenburgischen Seenplatte"
      )
    ).toBeInTheDocument();
  });

  it("renders call to action buttons", async () => {
    render(await Home());

    expect(screen.getByText("Über Uns")).toBeInTheDocument();
    expect(screen.getByText("Kontakt aufnehmen")).toBeInTheDocument();
  });

  it("renders feature cards section", async () => {
    render(await Home());

    expect(screen.queryByText("Unser Angebot")).not.toBeInTheDocument();
    expect(screen.getByText("Termine")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Formulare")).toBeInTheDocument();
  });

  it("does not render about section on home page", async () => {
    render(await Home());

    expect(screen.queryByText("Über die RAG Schießsport MSE")).not.toBeInTheDocument();
  });

  it("renders feature card descriptions", async () => {
    render(await Home());

    expect(
      screen.getByText(
        /Informieren Sie sich über anstehende Veranstaltungen/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bleiben Sie auf dem Laufenden/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hier finden Sie alle relevanten Formulare/)
    ).toBeInTheDocument();
  });

  it("renders next event details on termine card", async () => {
    (prisma.event.findFirst as jest.Mock).mockResolvedValue({
      date: new Date("2026-03-12T00:00:00.000Z"),
    });

    render(await Home());

    expect(screen.getByText("Nächster Termin:")).toBeInTheDocument();
    expect(screen.getByText("12.03.2026")).toBeInTheDocument();
  });

  it("renders annual planning link when file exists", async () => {
    (access as jest.Mock).mockResolvedValue(undefined);
    const currentYear = new Date().getFullYear();

    render(await Home());

    expect(screen.getByRole("link", { name: `Jahresplanung ${currentYear}` })).toHaveAttribute(
      "href",
      `/dokumente/Jahresplanung${currentYear}.pdf`
    );
  });
});

describe("Home - Member Documents Card Visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);
    (access as jest.Mock).mockRejectedValue(new Error("not found"));
  });

  it("does not show member documents card for unauthenticated users", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    render(await Home());

    expect(screen.getByText("Termine")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Formulare")).toBeInTheDocument();
    expect(screen.queryByText("Dokumente für Mitglieder")).not.toBeInTheDocument();
  });

  it.each(["MEMBER", "AUDITOR", "ADMIN", "SITE_ADMINISTRATOR"] as const)(
    "shows member documents card for %s role",
    async (role) => {
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { id: "1", role },
      });

      render(await Home());

      expect(screen.getByText("Dokumente für Mitglieder")).toBeInTheDocument();
      expect(screen.queryByText("Formulare")).not.toBeInTheDocument();

      const visibleFeatureHeadings = [
        screen.queryByRole("heading", { name: "Termine" }),
        screen.queryByRole("heading", { name: "News" }),
        screen.queryByRole("heading", { name: "Formulare" }),
        screen.queryByRole("heading", { name: "Dokumente für Mitglieder" }),
      ].filter(Boolean);
      expect(visibleFeatureHeadings).toHaveLength(3);
    }
  );

  it("member documents card links to /mitglieder-dokumente", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "1", role: "MEMBER" },
    });

    render(await Home());

    const link = screen.getByRole("link", { name: /Dokumente für Mitglieder/ });
    expect(link).toHaveAttribute("href", "/mitglieder-dokumente");
  });
});
