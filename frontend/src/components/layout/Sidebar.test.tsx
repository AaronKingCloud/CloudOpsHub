import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../test/render";
import Sidebar from "./Sidebar";

const links = () => screen.getAllByRole("link").map((a) => a.textContent);

describe("Sidebar", () => {
  it("shows the main pages to everyone", () => {
    renderApp(<Sidebar open={false} onNavigate={() => {}} />);
    expect(links()).toEqual(["Overview", "Devices", "Alerts", "Accounts", "AWS Cloud"]);
  });

  it("adds Users only for admins", async () => {
    renderApp(<Sidebar open={false} onNavigate={() => {}} />, { as: "admin" });
    expect(await screen.findByRole("link", { name: "Users" })).toHaveAttribute("href", "/admin/users");
  });

  it("marks the current page", () => {
    renderApp(<Sidebar open={false} onNavigate={() => {}} />, { route: "/alerts" });
    expect(screen.getByRole("link", { name: "Alerts" })).toHaveAttribute("aria-current", "page");
  });
});
