import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, getStoredRefreshToken, getStoredToken, SESSION_EXPIRED_EVENT, setStoredRefreshToken, setStoredToken } from "./apiClient";

// Fake backend: accepts only "good-token"; anything else gets 401.
const backend: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const auth = String(config.headers.Authorization ?? "");
  const response = { config, headers: {}, statusText: "", data: { ok: true }, status: 200 };
  if (auth === "Bearer good-token") return response;
  throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
    ...response,
    status: 401,
    data: { detail: "Invalid or expired token" },
  });
};

const originalAdapter = apiClient.defaults.adapter;
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("silent token refresh", () => {
  it("swaps an expired token for a new one and retries the request", async () => {
    apiClient.defaults.adapter = backend;
    setStoredToken("expired-token");
    setStoredRefreshToken("refresh-token");
    const refresh = vi.spyOn(axios, "post").mockResolvedValue({ data: { accessToken: "good-token" } });

    const res = await apiClient.get("/aws/ec2");

    expect(res.data).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0][1]).toEqual({ refreshToken: "refresh-token" });
    expect(getStoredToken()).toBe("good-token");
  });

  it("refreshes only once when several requests fail together", async () => {
    apiClient.defaults.adapter = backend;
    setStoredToken("expired-token");
    setStoredRefreshToken("refresh-token");
    const refresh = vi.spyOn(axios, "post").mockResolvedValue({ data: { accessToken: "good-token" } });

    await Promise.all([apiClient.get("/a"), apiClient.get("/b"), apiClient.get("/c")]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("signs the user out when the refresh token is rejected too", async () => {
    apiClient.defaults.adapter = backend;
    setStoredToken("expired-token");
    setStoredRefreshToken("bad-refresh");
    vi.spyOn(axios, "post").mockRejectedValue(new AxiosError("Unauthorized"));
    const expired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);

    await expect(apiClient.get("/aws/ec2")).rejects.toBeInstanceOf(AxiosError);
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  });

  it("doesn't try to refresh a failed login", async () => {
    apiClient.defaults.adapter = backend;
    setStoredRefreshToken("refresh-token");
    const refresh = vi.spyOn(axios, "post");

    await expect(apiClient.post("/auth/login", {}, { headers: new AxiosHeaders() })).rejects.toBeInstanceOf(AxiosError);
    expect(refresh).not.toHaveBeenCalled();
  });
});
