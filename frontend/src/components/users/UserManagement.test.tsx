import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import UsersPage from "../../pages/UsersPage";
import { renderApp } from "../../test/render";
import UserNav from "../UserNav";

const rowFor = async (username: string) =>
  (await screen.findByText(username, { selector: ".row-title, .row-title *" })).closest("tr")!;

describe("Edit user (admin)", () => {
  it("changes another user's role", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    await userEvent.click(within(await rowFor("viewer")).getByRole("button", { name: "Edit viewer" }));
    const dialog = screen.getByRole("dialog", { name: "Edit viewer" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /operator/i }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Updated viewer: role viewer → operator.");
    expect(within(await rowFor("viewer")).getByText("operator")).toBeInTheDocument();
  });

  it("disables a user", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    await userEvent.click(within(await rowFor("operator")).getByRole("button", { name: "Edit operator" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Account active/ }));
    expect(within(dialog).getByText(/Can't sign in/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("status")).toHaveTextContent("disabled (can't sign in)");
    expect(within(await rowFor("operator")).getByText("disabled")).toBeInTheDocument();
  });

  it("won't let admins demote or disable themselves", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    const me = await rowFor("admin");
    expect(within(me).getByText("(you)")).toBeInTheDocument();
    await userEvent.click(within(me).getByRole("button", { name: "Edit admin" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/This is your own account/)).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /viewer/i })).toBeDisabled();
    expect(within(dialog).getByRole("checkbox", { name: /Account active/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("keeps Save disabled until something changes", async () => {
    renderApp(<UsersPage />, { route: "/admin/users", as: "admin" });
    await userEvent.click(within(await rowFor("viewer")).getByRole("button", { name: "Edit viewer" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});

describe("Change password (any signed-in user)", () => {
  const open = async () => {
    renderApp(<UserNav />, { as: "viewer" });
    await userEvent.click(await screen.findByRole("button", { name: "Change password" }));
    return screen.getByRole("dialog", { name: "Change password" });
  };

  it("checks the new password before sending", async () => {
    const dialog = await open();
    await userEvent.type(within(dialog).getByLabelText("Current password"), "Viewer123!");
    await userEvent.type(within(dialog).getByLabelText(/^New password/), "short");
    await userEvent.type(within(dialog).getByLabelText("Confirm new password"), "other");
    await userEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(within(dialog).getByText("Must be 8–128 characters")).toBeInTheDocument();
    expect(within(dialog).getByText("Doesn't match the new password")).toBeInTheDocument();
  });

  it("shows the reason when the current password is wrong", async () => {
    const dialog = await open();
    await userEvent.type(within(dialog).getByLabelText("Current password"), "nope-nope");
    await userEvent.type(within(dialog).getByLabelText(/^New password/), "NewPass1234");
    await userEvent.type(within(dialog).getByLabelText("Confirm new password"), "NewPass1234");
    await userEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(await within(dialog).findByText("Current password is incorrect")).toBeInTheDocument();
  });

  it("changes the password", async () => {
    const dialog = await open();
    await userEvent.type(within(dialog).getByLabelText("Current password"), "Viewer123!");
    await userEvent.type(within(dialog).getByLabelText(/^New password/), "NewPass1234");
    await userEvent.type(within(dialog).getByLabelText("Confirm new password"), "NewPass1234");
    await userEvent.click(within(dialog).getByRole("button", { name: "Change password" }));
    expect(await within(dialog).findByText(/Password changed/)).toBeInTheDocument();
  });
});
