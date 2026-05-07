import React from 'react';
import { fetchDevices, fetchProvisioningCredentials } from '@/features/devices/api';
import type { Device, ProvisioningCredentials } from '@/features/devices/api';

// ── useUnclaimedDevices ───────────────────────────────────────────────────────

interface UseUnclaimedDevicesReturn {
  devices: Device[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useUnclaimedDevices(): UseUnclaimedDevicesReturn {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);

    fetchDevices('unclaimed')
      .then(setDevices)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  React.useEffect(() => {
    load();
  }, []);

  return { devices, loading, error, refresh: load };
}

// ── useProvisioningCredentials ────────────────────────────────────────────────

interface UseProvisioningCredentialsReturn {
  credentials: ProvisioningCredentials | null;
  loading: boolean;
  error: string | null;
  fetch: (deviceId: string) => void;
}

export function useProvisioningCredentials(): UseProvisioningCredentialsReturn {
  const [credentials, setCredentials] = React.useState<ProvisioningCredentials | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function fetch(deviceId: string) {
    setLoading(true);
    setError(null);
    setCredentials(null);

    fetchProvisioningCredentials(deviceId)
      .then(setCredentials)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  return { credentials, loading, error, fetch };
}
