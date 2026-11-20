import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-11-20T12:00:00Z");

describe("timeAgo", () => {
  it("describes past times in the largest whole unit", () => {
    expect(timeAgo("2026-11-20T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-11-20T11:55:00Z", now)).toBe("5 minutes ago");
    expect(timeAgo("2026-11-20T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-11-17T12:00:00Z", now)).toBe("3 days ago");
  });

  it("says yesterday instead of 1 day ago", () => {
    expect(timeAgo("2026-11-19T12:00:00Z", now)).toBe("yesterday");
  });

  it("returns the input unchanged when it isn't a date", () => {
    expect(timeAgo("not a date", now)).toBe("not a date");
  });
});
