global.fetch = jest.fn();

import { renderHook, cleanup } from "@testing-library/react";
import { useAdminCrud } from "../lib/use-admin-crud";

describe("Admin CRUD utilities", () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe("createFetchHandler", () => {
    it("should return a handler function", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      expect(typeof handler).toBe("function");
    });

    it("should set loading state during fetch", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      await handler();

      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });

    it("should call fetch with correct URL and method", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      await handler();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "test" }),
        })
      );
    });

    it("should include ID in URL when provided", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = result.current.createFetchHandler(
        "/api/test",
        "PUT",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      await handler("123");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test/123",
        expect.any(Object)
      );
    });

    it("should return success and data on successful response", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      const mockData = { id: "123", name: "Test Item" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      const returnResult = await handler();

      expect(returnResult).toEqual({ success: true, data: mockData });
    });

    it("should set error and return failure on API error", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Validation failed" }),
      });

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      const returnResult = await handler();

      expect(mockSetError).toHaveBeenCalledWith("Validation failed");
      expect(returnResult).toEqual({ success: false });
    });

    it("should use default error message when none provided", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      await handler();

      expect(mockSetError).toHaveBeenCalledWith("Ein Fehler ist aufgetreten");
    });

    it("should handle network errors", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      const returnResult = await handler();

      expect(mockSetError).toHaveBeenCalledWith("Network error");
      expect(returnResult).toEqual({ success: false });
    });

    it("should handle unknown error types", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockRejectedValueOnce("string error");

      const handler = result.current.createFetchHandler(
        "/api/test",
        "POST",
        mockSetError,
        mockSetIsLoading,
        { name: "test" }
      );

      const returnResult = await handler();

      expect(mockSetError).toHaveBeenCalledWith("Ein Fehler ist aufgetreten");
      expect(returnResult).toEqual({ success: false });
    });

    it("should handle DELETE method", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = result.current.createFetchHandler(
        "/api/test",
        "DELETE",
        mockSetError,
        mockSetIsLoading
      );

      await handler("123");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test/123",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("createDeleteHandler", () => {
    beforeAll(() => {
      window.confirm = jest.fn(() => true);
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return a handler function", () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockFetchHandler = jest.fn().mockResolvedValue({ success: true });
      const mockSetSuccess = jest.fn();
      const mockRefresh = jest.fn();

      const handler = result.current.createDeleteHandler(
        mockFetchHandler,
        mockSetSuccess,
        "Erfolgreich gelöscht",
        mockRefresh
      );

      expect(typeof handler).toBe("function");
    });

    it("should call fetchHandler when confirmed", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockFetchHandler = jest.fn().mockResolvedValue({ success: true });
      const mockSetSuccess = jest.fn();
      const mockRefresh = jest.fn();

      const handler = result.current.createDeleteHandler(
        mockFetchHandler,
        mockSetSuccess,
        "Erfolgreich gelöscht",
        mockRefresh
      );

      await handler("123");

      expect(mockFetchHandler).toHaveBeenCalledWith("123");
    });

    it("should not call fetchHandler when not confirmed", async () => {
      (window.confirm as jest.Mock).mockReturnValueOnce(false);
      const { result } = renderHook(() => useAdminCrud());
      const mockFetchHandler = jest.fn().mockResolvedValue({ success: true });
      const mockSetSuccess = jest.fn();
      const mockRefresh = jest.fn();

      const handler = result.current.createDeleteHandler(
        mockFetchHandler,
        mockSetSuccess,
        "Erfolgreich gelöscht",
        mockRefresh
      );

      await handler("123");

      expect(mockFetchHandler).not.toHaveBeenCalled();
      expect(mockSetSuccess).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("should set success message on successful deletion", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockFetchHandler = jest.fn().mockResolvedValue({ success: true });
      const mockSetSuccess = jest.fn();
      const mockRefresh = jest.fn();

      const handler = result.current.createDeleteHandler(
        mockFetchHandler,
        mockSetSuccess,
        "Erfolgreich gelöscht",
        mockRefresh
      );

      await handler("123");

      expect(mockSetSuccess).toHaveBeenCalledWith("Erfolgreich gelöscht");
    });

    it("should call refresh function after successful deletion", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockFetchHandler = jest.fn().mockResolvedValue({ success: true });
      const mockSetSuccess = jest.fn();
      const mockRefresh = jest.fn();

      const handler = result.current.createDeleteHandler(
        mockFetchHandler,
        mockSetSuccess,
        "Erfolgreich gelöscht",
        mockRefresh
      );

      await handler("123");

      expect(mockRefresh).toHaveBeenCalled();
    });

    it("should not set success message on failed deletion", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockFetchHandler = jest.fn().mockResolvedValue({ success: false });
      const mockSetSuccess = jest.fn();
      const mockRefresh = jest.fn();

      const handler = result.current.createDeleteHandler(
        mockFetchHandler,
        mockSetSuccess,
        "Erfolgreich gelöscht",
        mockRefresh
      );

      await handler("123");

      expect(mockSetSuccess).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe("createFetchDataHandler", () => {
    it("should return a handler function", () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading
      );

      expect(typeof handler).toBe("function");
    });

    it("should fetch data and set it", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockData = [{ id: "1", name: "Test" }];
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading
      );

      await handler();

      expect(mockSetData).toHaveBeenCalledWith(mockData);
    });

    it("should handle dataKey parameter", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockData = { events: [{ id: "1", name: "Test" }] };
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading,
        undefined,
        "events"
      );

      await handler();

      expect(mockSetData).toHaveBeenCalledWith(mockData.events);
    });

    it("should handle 401/403 errors and redirect", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockRouter = { push: jest.fn() };
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading,
        mockRouter
      );

      await handler();

      expect(mockRouter.push).toHaveBeenCalledWith("/login?returnUrl=%2F");
    });

    it("should handle 403 errors and redirect", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockRouter = { push: jest.fn() };
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading,
        mockRouter
      );

      await handler();

      expect(mockRouter.push).toHaveBeenCalledWith("/login?returnUrl=%2F");
    });

    it("should set error on non-401/403 errors", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockRouter = { push: jest.fn() };
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading,
        mockRouter
      );

      await handler();

      expect(mockSetError).toHaveBeenCalledWith("Fehler beim Laden der Daten");
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("should prevent race conditions by aborting previous requests", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      let resolveFirst: (value: { id: string; name: string }) => void;
      let resolveSecond: (value: { id: string; name: string }) => void;

      const firstCallPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const secondCallPromise = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      mockFetch
        .mockImplementationOnce(() => {
          const response = {
            ok: true,
            json: () => firstCallPromise,
          };
          return response;
        })
        .mockImplementationOnce(() => {
          const response = {
            ok: true,
            json: () => secondCallPromise,
          };
          return response;
        });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading
      );

      const firstRequest = handler();
      const secondRequest = handler();

      resolveFirst!({ id: "1", name: "Old Data" });

      await firstRequest;

      resolveSecond!({ id: "2", name: "New Data" });

      await secondRequest;

      expect(mockSetData).toHaveBeenCalledTimes(1);
      expect(mockSetData).toHaveBeenCalledWith({ id: "2", name: "New Data" });
    });

    it("should handle abort errors gracefully", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      const abortError = {
            name: "AbortError",
            message: "The operation was aborted",
          };

      const secondCallPromise = Promise.resolve({ id: "2", name: "New Data" });

      mockFetch
        .mockImplementationOnce(() => {
          const response = {
            ok: true,
            json: () => Promise.reject(abortError),
          };
          return response;
        })
        .mockImplementationOnce(() => {
          const response = {
            ok: true,
            json: () => secondCallPromise,
          };
          return response;
        });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading
      );

      const firstRequest = handler();
      const secondRequest = handler();

      await Promise.all([firstRequest, secondRequest]);

      expect(mockSetError).not.toHaveBeenCalledWith(expect.stringMatching(/.+/));
      expect(mockSetData).toHaveBeenCalledWith({ id: "2", name: "New Data" });
    });

    it("should set loading state correctly with race conditions", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetData = jest.fn();
      const mockSetError = jest.fn();
      const mockSetIsLoading = jest.fn();

      let resolveFirst: (value: { id: string; name: string }) => void;
      let resolveSecond: (value: { id: string; name: string }) => void;

      const firstCallPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      const secondCallPromise = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      mockFetch
        .mockImplementationOnce(() => {
          const response = {
            ok: true,
            json: () => firstCallPromise,
          };
          return response;
        })
        .mockImplementationOnce(() => {
          const response = {
            ok: true,
            json: () => secondCallPromise,
          };
          return response;
        });

      const handler = result.current.createFetchDataHandler(
        "/api/test",
        mockSetData,
        mockSetError,
        mockSetIsLoading
      );

      const firstRequest = handler();

      const secondRequest = handler();

      resolveFirst!({ id: "1", name: "Old Data" });

      await firstRequest;

      resolveSecond!({ id: "2", name: "New Data" });

      await secondRequest;

      expect(mockSetIsLoading).toHaveBeenCalledTimes(1);
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });
  });

  describe("createPublishHandler", () => {
    it("should return a handler function", () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      expect(typeof handler).toBe("function");
    });

    it("should call fetch with correct URL and method", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      await handler("/api/admin/events/123", { visible: true }, {
        success: "Termin wurde veröffentlicht",
        error: "Fehler beim Veröffentlichen",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/events/123",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visible: true }),
        })
      );
    });

    it("should set success message on successful publish", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      await handler("/api/admin/events/123", { visible: true }, {
        success: "Termin wurde veröffentlicht",
        error: "Fehler beim Veröffentlichen",
      });

      expect(mockSetSuccess).toHaveBeenCalledWith("Termin wurde veröffentlicht");
    });

    it("should call refresh function after successful publish", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      await handler("/api/admin/events/123", { visible: true }, {
        success: "Termin wurde veröffentlicht",
        error: "Fehler beim Veröffentlichen",
      });

      expect(mockRefresh).toHaveBeenCalled();
    });

    it("should set error on failed publish", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      await handler("/api/admin/events/123", { visible: true }, {
        success: "Termin wurde veröffentlicht",
        error: "Fehler beim Veröffentlichen",
      });

      expect(mockSetError).toHaveBeenCalledWith("Unauthorized");
      expect(mockSetSuccess).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("should use default error message when none provided", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      await handler("/api/admin/events/123", { visible: true }, {
        success: "Termin wurde veröffentlicht",
        error: "Fehler beim Veröffentlichen",
      });

      expect(mockSetError).toHaveBeenLastCalledWith("Fehler beim Veröffentlichen");
    });

    it("should handle network errors", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      await handler("/api/admin/events/123", { visible: true }, {
        success: "Termin wurde veröffentlicht",
        error: "Fehler beim Veröffentlichen",
      });

      expect(mockSetError).toHaveBeenLastCalledWith("Network error");
    });

    it("should handle unknown error types", async () => {
      const { result } = renderHook(() => useAdminCrud());
      const mockSetSuccess = jest.fn();
      const mockSetError = jest.fn();
      const mockRefresh = jest.fn();

      mockFetch.mockRejectedValueOnce("string error");

      const handler = result.current.createPublishHandler(mockSetSuccess, mockSetError, mockRefresh);

      await handler("/api/admin/events/123", { visible: true }, {
        success: "Termin wurde veröffentlicht",
        error: "Fehler beim Veröffentlichen",
      });

      expect(mockSetError).toHaveBeenLastCalledWith("Ein Fehler ist aufgetreten");
    });
  });
});
