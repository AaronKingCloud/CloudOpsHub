import { screen, waitFor, within } from "@testing-library/react";
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
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toMatch(/^warningproxmox-host memory above 70%Open · started/);

    await userEvent.click(screen.getByRole("button", { name: "Info (0)" }));
    expect(screen.getByText("No info alerts.")).toBeInTheDocument();
  });

  it("hides resolved alerts until history is switched on", async () => {
    renderApp(<AlertsPanel showFilter />);
    await screen.findByText(/nas-01 storage/);
    expect(screen.queryByText(/plex-server CPU above 70%/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Including resolved" }));
    expect(await screen.findByText(/plex-server CPU above 70%/)).toBeInTheDocument();
  });
});

describe("AlertsPanel actions", () => {
  it("hides Acknowledge and Resolve from viewers", async () => {
    renderApp(<AlertsPanel showFilter />, { as: "viewer" });
    await screen.findByText(/nas-01 storage/);
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
  });

  it("lets an operator acknowledge, then resolve an alert", async () => {
    renderApp(<AlertsPanel showFilter />, { as: "operator" });
    const item = (await screen.findByText(/backup-vm is offline/)).closest("li")!;

    await userEvent.click(within(item).getByRole("button", { name: "Acknowledge" }));
    expect(await within(item).findByText(/Acknowledged by operator/)).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();

    await userEvent.click(within(item).getByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(screen.queryByText(/backup-vm is offline/)).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Including resolved" }));
    expect(await screen.findByText(/backup-vm is offline/)).toBeInTheDocument();
  });

  it("links an alert to its device", async () => {
    renderApp(<AlertsPanel showFilter />);
    const link = await screen.findByRole("link", { name: /proxmox-host memory/ });
    expect(link).toHaveAttribute("href", "/devices/3");
  });
});
