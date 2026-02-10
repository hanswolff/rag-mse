import { render, screen } from "@testing-library/react";
import Home from "@/app/page";
import { prisma } from "@/lib/prisma";
import { access } from "node:fs/promises";

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

describe("Home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.event.findFirst as jest.Mock).mockResolvedValue(null);
    (access as jest.Mock).mockRejectedValue(new Error("not found"));
  });

  it("renders hero section with title and description", async () => {
    render(await Home());

    expect(
      screen.getByText("RAG Schießsport MSE")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Willkommen auf der Website der RAG Schießsport MSE"
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
