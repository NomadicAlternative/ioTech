import React from 'react';
import ProvisioningModal from './components/ProvisioningModal';
import type { ProvisioningResult } from './components/ProvisioningModal';
import { useUnclaimedDevices } from './hooks';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SelectedDevice {
  id: string;
  name: string;
  claimToken: string;
  hardwareId: string | null;
}

// ── Web Serial availability check ─────────────────────────────────────────────

function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProvisioningPage() {
  const { devices, loading, error, refresh } = useUnclaimedDevices();

  // Modal state
  const [selectedDevice, setSelectedDevice] = React.useState<SelectedDevice | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const webSerialSupported = isWebSerialSupported();

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleProvisionClick(device: SelectedDevice) {
    setSelectedDevice(device);
    setIsModalOpen(true);
    setStatusMessage(null);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setSelectedDevice(null);
  }

  function handleProvisionResult(result: ProvisioningResult) {
    if (result.success) {
      setStatusMessage({ type: 'success', text: result.message });
      // Refresh the device list so the provisioned device disappears from "unclaimed"
      refresh();
    } else {
      setStatusMessage({ type: 'error', text: result.message });
    }
  }

  function handleCopyToken(token: string) {
    navigator.clipboard.writeText(token).catch(() => {
      // Fallback: ignore clipboard errors
    });
  }

  // ── Render: unsupported browser fallback ────────────────────────────────────

  if (!webSerialSupported) {
    return (
      <div className="p-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Device Provisioning</h1>
        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          <p className="font-semibold">Web Serial API not supported</p>
          <p className="mt-1 text-sm">
            Device provisioning requires the Web Serial API, which is only available in
            Chrome-based browsers (Chrome, Edge, Opera). Please open this page in Chrome
            or Edge to provision devices.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: main page ───────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Device Provisioning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Provision unclaimed devices via serial connection
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>

      {/* ── Status message ────────────────────────────────────────────────── */}
      {statusMessage && (
        <div
          className={`mb-4 rounded-md p-3 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Error loading devices: {error}
        </div>
      )}

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading unclaimed devices...
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!loading && !error && devices.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No unclaimed devices</p>
          <p className="mt-1 text-sm">
            All devices have been provisioned or no devices are registered yet.
          </p>
        </div>
      )}

      {/* ── Device list ───────────────────────────────────────────────────── */}
      {!loading && devices.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Hardware ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Claim Token
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {device.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {device.hardwareId ?? (
                      <span className="italic text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {device.claimToken ? (
                      <button
                        onClick={() => handleCopyToken(device.claimToken!)}
                        className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600 hover:bg-gray-200"
                        title="Copy claim token"
                      >
                        {device.claimToken.slice(0, 12)}...
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    ) : (
                      <span className="italic text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      {device.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        handleProvisionClick({
                          id: device.id,
                          name: device.name,
                          claimToken: device.claimToken ?? '',
                          hardwareId: device.hardwareId,
                        })
                      }
                      disabled={!device.claimToken}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Provision
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Provisioning Modal ────────────────────────────────────────────── */}
      {selectedDevice && (
        <ProvisioningModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          deviceName={selectedDevice.name}
          deviceId={selectedDevice.id}
          claimToken={selectedDevice.claimToken}
          hardwareId={selectedDevice.hardwareId}
          onResult={handleProvisionResult}
        />
      )}
    </div>
  );
}
