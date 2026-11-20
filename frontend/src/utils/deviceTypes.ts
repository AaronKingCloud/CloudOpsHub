import type { DeviceType } from "../types/Dashboard";

// Display names for device types, in the order the "Type" dropdown shows them.
export const DEVICE_TYPES: Record<DeviceType, string> = {
  server: "Server",
  vm: "Virtual machine",
  container: "Container",
  nas: "NAS / storage",
  service: "Service",
};
