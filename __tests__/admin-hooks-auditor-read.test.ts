import { renderHook, waitFor } from "@testing-library/react";
import { useEventManagement } from "@/lib/use-event-management";
import { useRangeManagement } from "@/lib/use-range-management";

jest.mock("@/components/confirm-dialog", () => ({
  useConfirmDialog: () => jest.fn().mockResolvedValue(true),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockAuth = { status: "authenticated", session: { user: { id: "auditor-1", role: "AUDITOR" } } };

jest.mock("@/lib/use-admin-auth", () => ({
  useAdminAuth: () => mockAuth,
}));

describe("admin list hooks for AUDITOR", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [], ranges: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    }) as jest.Mock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("loads events and finishes loading", async () => {
    const { result } = renderHook(() => useEventManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/admin/events"));
  });

  it("loads ranges and finishes loading", async () => {
    const { result } = renderHook(() => useRangeManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/ranges");
  });
});
