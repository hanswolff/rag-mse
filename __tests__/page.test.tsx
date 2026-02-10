import { render, screen } from "@testing-library/react";
import Home from "../app/page";
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

  it("renders the main heading", async () => {
    render(await Home());
    const heading = screen.getByRole("heading", {
      name: "RAG Schießsport MSE",
    });
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe("H1");
  });

  it("renders the welcome message", async () => {
    render(await Home());
    const message = screen.getByText(
      "Willkommen auf der Website der RAG Schießsport MSE"
    );
    expect(message).toBeInTheDocument();
    expect(message.tagName).toBe("P");
  });

  it("renders the main element", async () => {
    const { container } = render(await Home());
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders the section element", async () => {
    const { container } = render(await Home());
    const section = container.querySelector("section");
    expect(section).toBeInTheDocument();
  });
});
