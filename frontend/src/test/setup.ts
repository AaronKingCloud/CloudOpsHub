import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Each test starts with an empty page and no signed-in user.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
