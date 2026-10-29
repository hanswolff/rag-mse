import { FormEvent } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { usePaginatedAdminList } from "@/lib/use-paginated-admin-list";
import { UserWithRole } from "@/lib/permissions";

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

type Item = { id: string; name: string };
type ItemsResponse = {
  items: Item[];
  pagination: { total: number; page: number; limit: number; pages: number };
};

const extractItems = (data: ItemsResponse) => data.items;
const canAccess = (user: UserWithRole) => user?.role === "ADMIN";

function mockAuthenticatedSession(role: string) {
  (useSession as jest.Mock).mockReturnValue({
    data: { user: { id: "user-1", role } },
    status: "authenticated",
  });
}

function mockFetchEchoingPage(items: Item[], total = items.length, pages = 1) {
  global.fetch = jest.fn().mockImplementation(async (input: string) => {
    const url = new URL(input, "http://localhost");
    return {
      ok: true,
      json: async () => ({
        items,
        pagination: {
          total,
          page: Number(url.searchParams.get("page")),
          limit: Number(url.searchParams.get("limit")),
          pages,
        },
      }),
    };
  }) as jest.Mock;
}

function renderList(extraParams?: Record<string, string>) {
  return renderHook(
    (props: { extraParams?: Record<string, string> }) =>
      usePaginatedAdminList<Item, "name" | "createdAt", ItemsResponse>({
        endpoint: "/api/admin/things",
        extractItems,
        loadErrorMessage: "Dinge konnten nicht geladen werden",
        canAccess,
        initialSortField: "createdAt",
        initialSortDirection: "desc",
        extraParams: props.extraParams,
      }),
    { initialProps: { extraParams } },
  );
}

const submitEvent = { preventDefault: jest.fn() } as unknown as FormEvent<HTMLFormElement>;

describe("usePaginatedAdminList", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockAuthenticatedSession("ADMIN");
    mockFetchEchoingPage([{ id: "1", name: "Alpha" }], 41, 3);
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("lädt nach Authentifizierung genau einmal mit Standardparametern", async () => {
    const { result } = renderList();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/admin/things?page=1&limit=20&sortBy=createdAt&sortDir=desc");
    expect(result.current.items).toEqual([{ id: "1", name: "Alpha" }]);
    expect(result.current.total).toBe(41);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.error).toBeNull();
  });

  it("setzt bei der Suche die Seite zurück und übergibt den getrimmten Suchbegriff", async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(result.current.page).toBe(2));

    act(() => {
      result.current.setSearchInput("  alpha  ");
    });
    act(() => {
      result.current.handleSubmitSearch(submitEvent);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        "/api/admin/things?page=1&limit=20&sortBy=createdAt&sortDir=desc&q=alpha",
      );
    });
    expect(result.current.searchQuery).toBe("alpha");
  });

  it("lädt beim Seitenwechsel die angeforderte Seite", async () => {
    const { result } = renderList();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setPage(3);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith("/api/admin/things?page=3&limit=20&sortBy=createdAt&sortDir=desc");
    });
    expect(result.current.page).toBe(3);
  });

  it("hängt extraParams an und lädt bei deren Änderung neu", async () => {
    const { result, rerender } = renderList({ type: "event" });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/things?page=1&limit=20&sortBy=createdAt&sortDir=desc&type=event",
      );
    });

    rerender({ extraParams: { type: "poll" } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        "/api/admin/things?page=1&limit=20&sortBy=createdAt&sortDir=desc&type=poll",
      );
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  it("zeigt die Fehlermeldung der API und leert die Liste bei Fehlern", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Keine Berechtigung" }),
    }) as jest.Mock;

    const { result } = renderList();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Keine Berechtigung");
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(0);
  });

  it("leitet ohne Berechtigung zur Startseite um und lädt nicht", async () => {
    mockAuthenticatedSession("MEMBER");

    renderList();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
