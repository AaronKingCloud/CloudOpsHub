import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";
import { loginUser } from "../services/authService";
import { renderApp } from "../test/render";
import LoginPage from "./LoginPage";

vi.mock("../services/authService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/authService")>()),
  loginUser: vi.fn(),
}));

function backendRejects(status: number, detail: string) {
  const config = { headers: new AxiosHeaders() };
  vi.mocked(loginUser).mockRejectedValueOnce(
    new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, {
      status,
      statusText: "",
      headers: {},
      config,
      data: { detail },
    }),
  );
}

async function signIn(username: string, password: string) {
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
}

describe("LoginPage errors", () => {
  it("shows the backend's reason for a wrong password", async () => {
    backendRejects(401, "Incorrect username or password");
    renderApp(<LoginPage />);
    await signIn("admin", "nope");
    expect(await screen.findByText("Incorrect username or password")).toBeInTheDocument();
    expect(screen.queryByText(/status code/)).not.toBeInTheDocument();
  });

  it("shows the lockout message after too many attempts", async () => {
    backendRejects(429, "Too many failed sign-in attempts. Try again in 15 minute(s).");
    renderApp(<LoginPage />);
    await signIn("admin", "nope");
    expect(await screen.findByText(/Too many failed sign-in attempts/)).toBeInTheDocument();
  });
});
