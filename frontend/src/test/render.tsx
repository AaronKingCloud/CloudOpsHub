import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../context/AuthProvider";
import { MOCK_USERS } from "../mock/auth";
import type { UserRole } from "../types/Auth";

interface Options {
  route?: string;
  // Sign in as this role before rendering (mock mode accepts any stored token).
  as?: UserRole;
}

// Renders a component the way the app does: inside the router and the auth provider.
export function renderApp(ui: ReactElement, { route = "/", as }: Options = {}) {
  if (as) {
    localStorage.setItem("cloudopshub_access_token", `mock-jwt-token-for-${as}`);
    localStorage.setItem("cloudopshub_user", JSON.stringify(MOCK_USERS[as]));
  }
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthProvider>,
  );
}
