import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render";
import UsersPage from "./UsersPage";

describe("UsersPage", () => {
  it("blocks anyone who isn't an admin", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "viewer" });
    expect(await screen.findByText("Admins only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add user/ })).not.toBeInTheDocument();
  });

  it("lists users for an admin", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    expect(await screen.findByText("operator@cloudopshub.local")).toBeInTheDocument();
  });

  it("checks the form before sending it", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: /Add user/ }));
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));
    expect(screen.getByText("Must be 3–50 characters")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Must be 8–128 characters")).toBeInTheDocument();
  });

  it("creates a user and shows it in the list", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: /Add user/ }));
    await userEvent.type(screen.getByLabelText("Username"), "testuser");
    await userEvent.type(screen.getByLabelText("Email"), "testuser@cloudopshub.local");
    await userEvent.type(screen.getByLabelText(/^Temporary password/), "TempPass123");
    await userEvent.click(screen.getByRole("radio", { name: /operator/i }));
    await userEvent.click(screen.getByRole("button", { name: "Create user" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Created testuser as operator.");
    expect(await screen.findByText("testuser@cloudopshub.local")).toBeInTheDocument();
  });

  it("closes the dialog with Escape", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    await userEvent.click(await screen.findByRole("button", { name: /Add user/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
