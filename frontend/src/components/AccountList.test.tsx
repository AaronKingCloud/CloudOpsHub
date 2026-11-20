import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render";
import AccountList from "./AccountList";

describe("AccountList", () => {
  it("shows the most critical accounts first", async () => {
    renderApp(<AccountList />);
    await screen.findByText("AWS Production");
    const firstRow = screen.getAllByRole("row")[1];
    expect(within(firstRow).getByText("Critical")).toBeInTheDocument();
  });

  it("opens account details when a row is clicked", async () => {
    renderApp(<AccountList />);
    await userEvent.click(await screen.findByText("Azure Development"));
    expect(screen.getByRole("heading", { name: "Azure Development" })).toBeInTheDocument();
    expect(screen.getByText(/Monitor closely/)).toBeInTheDocument();
  });

  it("opens account details from the keyboard", async () => {
    renderApp(<AccountList />);
    const row = await screen.findByRole("row", { name: /AWS Sandbox/ });
    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "AWS Sandbox" })).toBeInTheDocument();
  });
});
