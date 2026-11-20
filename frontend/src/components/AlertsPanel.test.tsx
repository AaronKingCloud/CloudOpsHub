import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render";
import AlertsPanel from "./AlertsPanel";

const messages = () => screen.getAllByRole("listitem").map((li) => li.textContent);

describe("AlertsPanel", () => {
  it("lists the most severe alerts first", async () => {
    renderApp(<AlertsPanel />);
    await screen.findByText(/nas-01 storage/);
    const list = messages();
    expect(list[0]).toMatch(/^critical/);
    expect(list[list.length - 1]).toMatch(/^warning/);
  });

  it("filters by severity and shows counts on the Alerts page", async () => {
    renderApp(<AlertsPanel showFilter />);
    await screen.findByText(/nas-01 storage/);

    expect(screen.getByRole("button", { name: "Critical (2)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Warning (1)" }));
    expect(messages()).toEqual(["warningproxmox-host memory above 70%"]);

    await userEvent.click(screen.getByRole("button", { name: "Info (0)" }));
    expect(screen.getByText("No info alerts.")).toBeInTheDocument();
  });
});
