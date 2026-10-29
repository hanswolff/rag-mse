import { render, screen } from "@testing-library/react";
import VergangeneTerminePage from "@/app/termine/vergangenheit/page";
import { buildEvent } from "./helpers/factories";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

describe("VergangeneTerminePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(null);
    (prisma.event.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.event.count as jest.Mock).mockResolvedValue(0);
    (prisma.shootingRange.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("renders page title and description", async () => {
    const view = await VergangeneTerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("Termine in der Vergangenheit")).toBeInTheDocument();
    expect(screen.getByText("Rückblick auf vergangene Termine")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    const view = await VergangeneTerminePage({ searchParams: Promise.resolve({}) });
    render(view);

    expect(screen.getByText("Keine vergangenen Termine gefunden")).toBeInTheDocument();
  });

  it("renders past events", async () => {
    (prisma.event.findMany as jest.Mock).mockResolvedValue([
      buildEvent({
        id: "e1",
        date: new Date("2026-01-15T00:00:00.000Z"),
        location: "Stand A",
        description: "Training",
        type: "Training",
      }),
    ]);

    const view = await VergangeneTerminePage({ searchParams: Promise.resolve({ page: "1" }) });
    render(view);

    expect(screen.getByText("15.01.2026")).toBeInTheDocument();
    expect(screen.getByText("18:00 - 20:00")).toBeInTheDocument();
  });
});
