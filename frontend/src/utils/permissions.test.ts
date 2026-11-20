import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("can", () => {
  it("lets only admins manage users and devices", () => {
    expect(can("admin", "manageUsers")).toBe(true);
    expect(can("admin", "manageDevices")).toBe(true);
    expect(can("operator", "manageDevices")).toBe(false);
    expect(can("viewer", "manageUsers")).toBe(false);
  });

  it("lets admins and operators handle alerts, not viewers", () => {
    expect(can("admin", "handleAlerts")).toBe(true);
    expect(can("operator", "handleAlerts")).toBe(true);
    expect(can("viewer", "handleAlerts")).toBe(false);
  });

  it("allows nothing when signed out", () => {
    expect(can(null, "handleAlerts")).toBe(false);
    expect(can(undefined, "manageDevices")).toBe(false);
  });
});
