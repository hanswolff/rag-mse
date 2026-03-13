import { render, screen } from "@testing-library/react";
import TerminePage from "@/app/termine/page";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    shootingRange: {
      findMany: jest.fn(),
    },
  },
}));

describe("TerminePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.event.count as jest.Mock).mockResolvedValue(0);
    (prisma.shootingRange.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("renders page title and description", async () => {
    const view = await TerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("Termine")).toBeInTheDocument();
    expect(screen.getByText("Aktuelle Termine und Veranstaltungen")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    const view = await TerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("Keine Termine gefunden")).toBeInTheDocument();
  });

  it("renders events and pagination", async () => {
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "e1",
        date: new Date("2026-02-15T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Stand A",
        description: "Training",
        type: "Training",
        visible: true,
      },
    ]);
    (prisma.event.count as jest.Mock).mockResolvedValue(21);

    const view = await TerminePage({ searchParams: Promise.resolve({ page: "1" }) });
    render(view);

    expect(screen.getByText("15.02.2026")).toBeInTheDocument();
    expect(screen.getByText("18:00 - 20:00")).toBeInTheDocument();
    expect(screen.getByText("Zurück")).toBeInTheDocument();
    expect(screen.getByText("Weiter")).toBeInTheDocument();
  });

  it("shows admin button for admins", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });

    const view = await TerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("Termine verwalten")).toBeInTheDocument();
  });
});
