// Device / asset management. Endpoints are the PROPOSED contract in docs/api/frontend-contract.md
// ("Devices (proposed)"): the backend side is REMAINING_WORK task B2. Mock mode works today.

import { mockDevices, mockHistory, newAgentKey, nextId } from "../mock/store";
import type { AgentKeyResponse, Device, DeviceInput, DeviceMetric, MetricPoint } from "../types/Dashboard";
import { apiClient, USE_MOCK } from "./apiClient";

export class DeviceNotFoundError extends Error {
  constructor() {
    super("This device doesn't exist or was removed.");
  }
}

function findMock(id: number): Device {
  const device = mockDevices.find((d) => d.id === id);
  if (!device) throw new DeviceNotFoundError();
  return device;
}

export async function listDevices(): Promise<Device[]> {
  if (USE_MOCK) return mockDevices.map((d) => ({ ...d }));
  return (await apiClient.get<Device[]>("/devices")).data;
}

export async function getDevice(id: number): Promise<Device> {
  if (USE_MOCK) return { ...findMock(id) };
  try {
    return (await apiClient.get<Device>(`/devices/${id}`)).data;
  } catch (err) {
    // Until GET /devices/{id} exists (B2), fall back to finding it in the list.
    const fallback = (await listDevices()).find((d) => d.id === id);
    if (fallback) return fallback;
    throw err;
  }
}

// Returns the new device and its agent key (shown once).
export async function createDevice(input: DeviceInput): Promise<{ device: Device } & AgentKeyResponse> {
  if (USE_MOCK) {
    if (mockDevices.some((d) => d.hostname.toLowerCase() === input.hostname.toLowerCase())) {
      throw new Error("A device with this hostname already exists");
    }
    const device: Device = {
      ...input,
      id: nextId(mockDevices),
      status: "offline", // offline until its agent reports
      cpu: 0,
      memory: 0,
      storage: 0,
      lastSeen: null,
    };
    mockDevices.push(device);
    return { device: { ...device }, agentKey: newAgentKey() };
  }
  return (await apiClient.post<{ device: Device } & AgentKeyResponse>("/devices", input)).data;
}

export async function updateDevice(id: number, input: DeviceInput): Promise<Device> {
  if (USE_MOCK) {
    const device = findMock(id);
    Object.assign(device, input);
    return { ...device };
  }
  return (await apiClient.put<Device>(`/devices/${id}`, input)).data;
}

export async function deleteDevice(id: number): Promise<void> {
  if (USE_MOCK) {
    findMock(id);
    mockDevices.splice(
      mockDevices.findIndex((d) => d.id === id),
      1,
    );
    return;
  }
  await apiClient.delete(`/devices/${id}`);
}

// Replaces the device's agent key; the old key stops working immediately.
export async function rotateAgentKey(id: number): Promise<AgentKeyResponse> {
  if (USE_MOCK) {
    findMock(id);
    return { agentKey: newAgentKey() };
  }
  return (await apiClient.post<AgentKeyResponse>(`/devices/${id}/agent-key`)).data;
}

export async function getDeviceMetrics(id: number, metric: DeviceMetric, hours: number): Promise<MetricPoint[]> {
  if (USE_MOCK) return mockHistory(findMock(id), metric, hours);
  return (await apiClient.get<MetricPoint[]>(`/devices/${id}/metrics`, { params: { metric, hours } })).data;
}
