/**
 * API types and helpers for the devices module.
 */

// ── Device types ──────────────────────────────────────────────────────────────

export type DeviceStatus = 'unclaimed' | 'claimed' | 'active' | 'inactive';

export interface Device {
  id: string;
  tenantId: string;
  templateId: string | null;
  clientId: string | null;
  name: string;
  status: DeviceStatus;
  lastSeen: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  claimToken: string | null;
  hardwareId: string | null;
}

export interface DeviceListResponse {
  data: Device[];
}

export interface ProvisioningCredentials {
  claimToken: string;
  hardwareId: string | null;
}

export interface ProvisioningCredentialsResponse {
  data: ProvisioningCredentials;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const API_BASE = '/api';

/**
 * Fetch devices with optional status filter.
 */
export async function fetchDevices(status?: DeviceStatus): Promise<Device[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const url = `${API_BASE}/devices${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? 'Failed to fetch devices');
  }

  const json: DeviceListResponse = await res.json();
  return json.data;
}

/**
 * Fetch provisioning credentials for a specific device.
 */
export async function fetchProvisioningCredentials(
  deviceId: string,
): Promise<ProvisioningCredentials> {
  const res = await fetch(`${API_BASE}/devices/${deviceId}/provisioning-credentials`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? 'Failed to fetch provisioning credentials');
  }

  const json: ProvisioningCredentialsResponse = await res.json();
  return json.data;
}
