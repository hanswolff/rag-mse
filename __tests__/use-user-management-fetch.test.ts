import { renderHook, waitFor } from "@testing-library/react";
import { useUserManagement } from "@/lib/use-user-management";

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/lib/use-admin-auth", () => ({
  useAdminAuth: () => ({
    status: "authenticated",
  }),
}));

jest.mock("@/lib/use-success-timer", () => ({
  useSuccessTimer: jest.fn(),
}));

describe("useUserManagement fetch behavior", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockPush.mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("fetches users only once after authentication", async () => {
    renderHook(() => useUserManagement());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });
});
