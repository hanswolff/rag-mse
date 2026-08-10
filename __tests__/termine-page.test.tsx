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
    expect(screen.getByText("Aktuelle Termine unseres Verbandes")).toBeInTheDocument();
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

  it("shows the title as heading and keeps date and time visible", async () => {
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "e1",
        date: new Date("2026-02-15T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Stand A",
        title: "Dynamisches Pistolenschießen Level 1",
        description: "Beschreibung",
        type: "Lehrgang",
        visible: true,
      },
    ]);
    (prisma.event.count as jest.Mock).mockResolvedValue(1);

    const view = await TerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(
      screen.getByRole("heading", { name: "Dynamisches Pistolenschießen Level 1" })
    ).toBeInTheDocument();
    expect(screen.getByText("15.02.2026, 18:00 - 20:00")).toBeInTheDocument();
  });

  it("keeps the date as heading when no title is set", async () => {
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: "e1",
        date: new Date("2026-02-15T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Stand A",
        title: null,
        description: "Beschreibung",
        type: null,
        visible: true,
      },
    ]);
    (prisma.event.count as jest.Mock).mockResolvedValue(1);

    const view = await TerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByRole("heading", { name: "15.02.2026" })).toBeInTheDocument();
    expect(screen.getByText("18:00 - 20:00")).toBeInTheDocument();
  });

  it("renders each Terminart with a visually distinct badge", async () => {
    (prisma.event.findMany as jest.Mock).mockResolvedValue(
      ["Training", "Wettkampf", "Lehrgang"].map((type, index) => ({
        id: `e${index}`,
        date: new Date("2026-02-15T00:00:00.000Z"),
        timeFrom: "18:00",
        timeTo: "20:00",
        location: "Stand A",
        description: "Beschreibung",
        type,
        visible: true,
      }))
    );
    (prisma.event.count as jest.Mock).mockResolvedValue(3);

    const view = await TerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    const badgeClasses = ["Training", "Wettkampf", "Lehrgang"].map(
      (type) => screen.getByText(type).className
    );

    expect(new Set(badgeClasses).size).toBe(3);
  });

  describe("Belegung", () => {
    const eventWithCapacity = {
      id: "e1",
      date: new Date("2026-02-15T00:00:00.000Z"),
      timeFrom: "18:00",
      timeTo: "20:00",
      location: "Stand A",
      title: null,
      description: "Beschreibung",
      type: "Lehrgang",
      visible: true,
      capacity: 12,
      votes: [{ vote: "JA" }, { vote: "JA" }, { vote: "VIELLEICHT" }],
      guestRegistrations: [{ vote: "JA" }],
    };

    it("shows the occupancy to logged-in users, counting guests", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "m1", role: "MEMBER" } });
      (prisma.event.findMany as jest.Mock).mockResolvedValue([eventWithCapacity]);
      (prisma.event.count as jest.Mock).mockResolvedValue(1);

      const view = await TerminePage({ searchParams: Promise.resolve({}) });
      render(view);

      expect(screen.getByText("3 von 12 Plätzen belegt (+1 vielleicht)")).toBeInTheDocument();
    });

    it("keeps the registration count unchanged without a capacity", async () => {
      (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "m1", role: "MEMBER" } });
      (prisma.event.findMany as jest.Mock).mockResolvedValue([
        { ...eventWithCapacity, capacity: null },
      ]);
      (prisma.event.count as jest.Mock).mockResolvedValue(1);

      const view = await TerminePage({ searchParams: Promise.resolve({}) });
      render(view);

      expect(screen.getByText("3-4 Anmeldungen")).toBeInTheDocument();
      expect(screen.queryByText(/belegt/)).not.toBeInTheDocument();
    });

    it("hides the occupancy from visitors without login", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);
      (prisma.event.findMany as jest.Mock).mockResolvedValue([
        {
          id: "e1",
          date: new Date("2026-02-15T00:00:00.000Z"),
          timeFrom: "18:00",
          timeTo: "20:00",
          location: "Stand A",
          title: null,
          description: "Beschreibung",
          type: "Lehrgang",
          visible: true,
        },
      ]);
      (prisma.event.count as jest.Mock).mockResolvedValue(1);

      const view = await TerminePage({ searchParams: Promise.resolve({}) });
      render(view);

      expect(screen.queryByText(/belegt/)).not.toBeInTheDocument();
    });
  });

  it("shows admin button for admins", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "a1", role: "ADMIN" } });

    const view = await TerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("Termine verwalten")).toBeInTheDocument();
  });
});
