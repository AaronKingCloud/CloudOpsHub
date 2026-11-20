import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { getErrorMessage, getErrorStatus } from "./errors";

function httpError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  });
}

describe("getErrorMessage", () => {
  it("shows the backend's own message", () => {
    expect(getErrorMessage(httpError(409, { detail: "Username or email already exists" }))).toBe(
      "Username or email already exists",
    );
  });

  it("names the field for validation errors", () => {
    const err = httpError(422, {
      detail: [{ loc: ["body", "password"], msg: "String should have at least 8 characters" }],
    });
    expect(getErrorMessage(err)).toBe("password: String should have at least 8 characters");
  });

  it("explains 401 and 403 in plain words", () => {
    expect(getErrorMessage(httpError(401, {}))).toBe("Please sign in to see this.");
    expect(getErrorMessage(httpError(403, {}))).toBe("Your role doesn't have access to this.");
  });

  it("says the backend is unreachable when there is no response", () => {
    expect(getErrorMessage(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
      "Can't reach the backend. Is it running?",
    );
  });

  it("falls back to a plain Error's message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage("weird")).toBe("Request failed");
  });
});

describe("getErrorStatus", () => {
  it("returns the HTTP status for HTTP errors only", () => {
    expect(getErrorStatus(httpError(502, {}))).toBe(502);
    expect(getErrorStatus(new Error("boom"))).toBeUndefined();
  });
});
