import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import NewsEditLayout from "@/app/admin/news/[id]/edit/layout";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

jest.mock("@/lib/auth", () => ({ authOptions: {} }));

describe("Layout der News-Bearbeitung", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("leitet Prüfer zur News-Übersicht um", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { role: "AUDITOR" } });

    await expect(NewsEditLayout({ children: "Formular" })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/admin/news");
  });

  it("zeigt Administratoren das Formular", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { role: "ADMIN" } });

    await expect(NewsEditLayout({ children: "Formular" })).resolves.toBe("Formular");
    expect(redirect).not.toHaveBeenCalled();
  });
});
