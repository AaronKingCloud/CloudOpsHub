import { act, screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AUTH_REQUIRED_EVENT } from "../../services/apiClient";
import { renderApp } from "../../test/render";
import AppLayout from "./AppLayout";

// Live mode: the sign-in screen only applies when talking to a real backend.
vi.mock("../../services/apiClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/apiClient")>()),
  USE_MOCK: false,
}));

const app = (
  <Routes>
    <Route element={<AppLayout />}>
      <Route index element={<p>Overview content</p>} />
    </Route>
  </Routes>
);

describe("AppLayout sign-in screen", () => {
  it("shows the page while the backend doesn't require login", () => {
    renderApp(app);
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });

  it("shows the sign-in form once the backend asks for a login", () => {
    renderApp(app);
    act(() => {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    });
    expect(screen.queryByText("Overview content")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sign in to CloudOps Hub/ })).toBeInTheDocument();
  });
});
