import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render";
import DeviceTable from "./DeviceTable";

const hostnames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("DeviceTable", () => {
  it("lists devices sorted by hostname", async () => {
    renderApp(<DeviceTable />);
    await screen.findByText("plex-server");
    expect(hostnames()).toEqual(["backup-vm", "nas-01", "pihole", "plex-server", "proxmox-host"]);
  });

  it("sorts by CPU, busiest first, when the header is clicked", async () => {
    renderApp(<DeviceTable />);
    await screen.findByText("plex-server");
    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));
    expect(hostnames()[0]).toBe("proxmox-host");
    expect(screen.getByRole("columnheader", { name: /CPU/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("searches and filters on the Devices page", async () => {
    renderApp(<DeviceTable showControls />);
    await screen.findByText("plex-server");

    await userEvent.type(screen.getByRole("searchbox"), "p");
    expect(hostnames()).toEqual(["backup-vm", "pihole", "plex-server", "proxmox-host"]);

    await userEvent.click(screen.getByRole("button", { name: "Offline" }));
    expect(hostnames()).toEqual(["backup-vm"]);

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "nas");
    expect(screen.getByText("No devices match your filters.")).toBeInTheDocument();
  });

  it("hides search and filters on the Overview", async () => {
    renderApp(<DeviceTable />);
    await screen.findByText("plex-server");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
