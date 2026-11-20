import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render";
import DeviceDetailPage from "./DeviceDetailPage";
import DevicesPage from "./DevicesPage";

const pages = (
  <Routes>
    <Route path="/devices" element={<DevicesPage />} />
    <Route path="/devices/:id" element={<DeviceDetailPage />} />
  </Routes>
);

describe("Device pages", () => {
  it("shows a device's details, current usage, alerts and agent setup", async () => {
    renderApp(pages, { route: "/devices/2" });
    expect(await screen.findByRole("heading", { name: "nas-01" })).toBeInTheDocument();
    expect(screen.getByText("NAS / storage")).toBeInTheDocument();
    expect(screen.getByText("192.168.1.30")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(await screen.findByText("nas-01 storage exceeds 90%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect the agent" })).toBeInTheDocument();
  });

  it("says when a device doesn't exist", async () => {
    renderApp(pages, { route: "/devices/999" });
    expect(await screen.findByRole("heading", { name: "Device not found" })).toBeInTheDocument();
  });

  it("hides Edit, Delete and new keys from viewers", async () => {
    renderApp(pages, { route: "/devices/1", as: "viewer" });
    await screen.findByRole("heading", { name: "plex-server" });
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new key/ })).not.toBeInTheDocument();
  });

  it("lets an admin add a device and shows its agent key once", async () => {
    renderApp(pages, { route: "/devices", as: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: "+ Add device" }));
    await userEvent.type(screen.getByLabelText("Hostname"), "grafana-lxc");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "container");
    await userEvent.type(screen.getByLabelText(/IP address/), "192.168.1.77");
    await userEvent.click(screen.getByRole("button", { name: "Add device" }));

    expect(await screen.findByRole("heading", { name: "grafana-lxc" })).toBeInTheDocument();
    expect(screen.getByText(/only time the key is shown/)).toBeInTheDocument();
    expect(screen.getByText(/^coa_[0-9a-f]{32}$/)).toBeInTheDocument();
    expect(screen.getByText(/--key coa_/)).toBeInTheDocument();
  });

  it("rejects a hostname with spaces before sending", async () => {
    renderApp(pages, { route: "/devices", as: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: "+ Add device" }));
    await userEvent.type(screen.getByLabelText("Hostname"), "my server");
    await userEvent.click(screen.getByRole("button", { name: "Add device" }));
    expect(screen.getByText(/Use letters, numbers, dots and hyphens/)).toBeInTheDocument();
  });

  it("lets an admin edit a device", async () => {
    renderApp(pages, { route: "/devices/4", as: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.clear(within(dialog).getByLabelText(/Description/));
    await userEvent.type(within(dialog).getByLabelText(/Description/), "Pi-hole in Docker");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Pi-hole in Docker")).toBeInTheDocument();
  });

  it("asks before deleting, then returns to the list", async () => {
    renderApp(pages, { route: "/devices/5", as: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete backup-vm?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete device" }));

    expect(await screen.findByText("Deleted backup-vm.")).toBeInTheDocument();
    await screen.findByText("plex-server");
    expect(screen.queryByRole("link", { name: "backup-vm" })).not.toBeInTheDocument();
  });
});
