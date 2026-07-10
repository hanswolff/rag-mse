import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AusschreibungenPage from "@/app/ausschreibungen/page";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    ausschreibung: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("next/dynamic", () => () => {
  function MockPdfViewer() {
    return <div data-testid="pdf-viewer" />;
  }
  return MockPdfViewer;
});

describe("AusschreibungenPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows an empty state when there are no ausschreibungen", async () => {
    (prisma.ausschreibung.findMany as jest.Mock).mockResolvedValue([]);

    const view = await AusschreibungenPage();
    render(view);

    expect(screen.getByText("Ausschreibungen")).toBeInTheDocument();
    expect(screen.getByText("Derzeit keine aktuellen Ausschreibungen")).toBeInTheDocument();
  });

  it("shows current ausschreibungen prominently and hides the archive by default", async () => {
    (prisma.ausschreibung.findMany as jest.Mock).mockResolvedValue([
      {
        id: "current-1",
        title: "Landesmeisterschaft",
        description: "Beschreibungstext",
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        originalFileName: "lm.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "historical-1",
        title: "Alte Ausschreibung",
        description: null,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        originalFileName: "alt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        createdAt: new Date("2019-01-01T00:00:00.000Z"),
      },
    ]);

    const view = await AusschreibungenPage();
    render(view);

    expect(screen.getByText("Landesmeisterschaft")).toBeInTheDocument();
    expect(screen.getByText("Beschreibungstext")).toBeInTheDocument();
    expect(screen.queryByText("Alte Ausschreibung")).not.toBeInTheDocument();
    expect(screen.getByText("Frühere Ausschreibungen (1)")).toBeInTheDocument();
  });

  it("reveals the archive when toggled", async () => {
    const user = userEvent.setup();
    (prisma.ausschreibung.findMany as jest.Mock).mockResolvedValue([
      {
        id: "historical-1",
        title: "Alte Ausschreibung",
        description: null,
        expiresAt: new Date("2020-01-01T00:00:00.000Z"),
        originalFileName: "alt.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        createdAt: new Date("2019-01-01T00:00:00.000Z"),
      },
    ]);

    const view = await AusschreibungenPage();
    render(view);

    expect(screen.queryByText("Alte Ausschreibung")).not.toBeInTheDocument();
    await user.click(screen.getByText("Frühere Ausschreibungen (1)"));
    expect(screen.getByText("Alte Ausschreibung")).toBeInTheDocument();
  });

  it("opens the PDF viewer when a listed ausschreibung is viewed", async () => {
    const user = userEvent.setup();
    (prisma.ausschreibung.findMany as jest.Mock).mockResolvedValue([
      {
        id: "current-1",
        title: "Landesmeisterschaft",
        description: null,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        originalFileName: "lm.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const view = await AusschreibungenPage();
    render(view);

    await user.click(screen.getByText("PDF ansehen"));
    expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
  });
});
