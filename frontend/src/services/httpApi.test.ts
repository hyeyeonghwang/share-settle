import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpExpenseSplitterApi } from "./httpApi";

const user = {
  id: "u_younghee",
  displayName: "Younghee",
  email: "younghee@example.com",
  authProvider: "google",
  createdAt: "2026-03-01T09:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("HttpExpenseSplitterApi", () => {
  it("stores the bearer token returned by sign in and sends it on later requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Auth-Token": "token-123" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const api = new HttpExpenseSplitterApi("http://backend.test/api");
    await api.signInAs(user.id);
    await api.listEvents();

    expect(fetchMock).toHaveBeenNthCalledWith(
      "1",
      "http://backend.test/api/auth/demo",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    const headers = fetchMock.mock.calls[1]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-123");
  });

  it("maps backend validation errors to Error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Title is required." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const api = new HttpExpenseSplitterApi("http://backend.test/api");

    await expect(api.listEvents()).rejects.toThrow("Title is required.");
  });
});
