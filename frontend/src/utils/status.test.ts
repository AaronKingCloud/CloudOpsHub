import { describe, expect, it } from "vitest";
import { accountTone, alertTone, deviceTone, ec2StateTone, roleTone, usageTone } from "./status";

describe("usageTone", () => {
  it("is green below 70%, amber from 70%, red from 90%", () => {
    expect(usageTone(0)).toBe("ok");
    expect(usageTone(69)).toBe("ok");
    expect(usageTone(70)).toBe("warn");
    expect(usageTone(89)).toBe("warn");
    expect(usageTone(90)).toBe("crit");
    expect(usageTone(100)).toBe("crit");
  });
});

describe("status colours", () => {
  it("maps account health", () => {
    expect(accountTone("Healthy")).toBe("ok");
    expect(accountTone("Warning")).toBe("warn");
    expect(accountTone("Critical")).toBe("crit");
  });

  it("maps alert severity", () => {
    expect(alertTone("info")).toBe("info");
    expect(alertTone("warning")).toBe("warn");
    expect(alertTone("critical")).toBe("crit");
  });

  it("treats offline devices as critical", () => {
    expect(deviceTone("online")).toBe("ok");
    expect(deviceTone("offline")).toBe("crit");
  });

  it("treats a stopped EC2 instance as normal, not an error", () => {
    expect(ec2StateTone("running")).toBe("ok");
    expect(ec2StateTone("stopped")).toBe("muted");
    expect(ec2StateTone("terminated")).toBe("crit");
    expect(ec2StateTone("pending")).toBe("info");
  });

  it("matches the role badge colours in the top bar", () => {
    expect(roleTone("admin")).toBe("crit");
    expect(roleTone("operator")).toBe("ok");
    expect(roleTone("viewer")).toBe("info");
  });
});
