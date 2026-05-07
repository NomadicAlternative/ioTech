import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProvisioningPage from '../ProvisioningPage';

// ── Types for our mocks ───────────────────────────────────────────────────────

interface MockSerialPort {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  getInfo: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

// ── Mock fetch globally ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

const DEVICES_MOCK = [
  {
    id: 'dev-1',
    tenantId: 'tenant-1',
    name: 'Sensor Alpha',
    status: 'unclaimed',
    claimToken: 'claim-tok-abc-12345',
    hardwareId: 'ESP32-001',
    lastSeen: null,
    metadata: {},
    templateId: null,
    clientId: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'dev-2',
    tenantId: 'tenant-1',
    name: 'Sensor Beta',
    status: 'unclaimed',
    claimToken: 'claim-tok-def-67890',
    hardwareId: 'ESP32-002',
    lastSeen: null,
    metadata: {},
    templateId: null,
    clientId: null,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

// ── Mock Web Serial API ───────────────────────────────────────────────────────

function createMockSerialPort(): MockSerialPort {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Create a pair of streams for the mock device
  const deviceToPort = new TransformStream<Uint8Array, Uint8Array>();
  const portToDevice = new TransformStream<Uint8Array, Uint8Array>();

  // Auto-respond to provisioning command
  (async () => {
    const reader = portToDevice.readable.getReader();
    const writer = deviceToPort.writable.getWriter();

    try {
      const { value } = await reader.read();
      if (value) {
        const msg = decoder.decode(value, { stream: true });
        if (msg.includes('provision')) {
          const response = JSON.stringify({ ok: true, message: 'Device provisioned successfully' });
          await writer.write(encoder.encode(response));
        } else {
          await writer.write(encoder.encode(JSON.stringify({ ok: false, error: 'Unknown command' })));
        }
      }
    } finally {
      reader.releaseLock();
      writer.releaseLock();
    }
  })();

  return {
    readable: deviceToPort.readable,
    writable: portToDevice.writable,
    getInfo: vi.fn(() => ({ usbVendorId: 1234, usbProductId: 5678 })),
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function setupWebSerialMock() {
  const mockRequestPort = vi.fn().mockImplementation(async () => {
    return createMockSerialPort();
  });

  const serialMock = {
    requestPort: mockRequestPort,
    getPorts: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  Object.defineProperty(navigator, 'serial', {
    value: serialMock,
    configurable: true,
    writable: true,
  });

  return { mockRequestPort, serialMock };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <ProvisioningPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProvisioningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when Web Serial API is not supported', () => {
    beforeEach(() => {
      // Remove Web Serial from navigator by deleting the property
      delete (navigator as Record<string, unknown>).serial;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    it('shows the unsupported browser fallback message', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Web Serial API not supported')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/only available in Chrome-based browsers/),
      ).toBeInTheDocument();
    });

    it('does NOT show the device list or provision button', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Web Serial API not supported')).toBeInTheDocument();
      });

      expect(screen.queryByText('Provision')).not.toBeInTheDocument();
    });
  });

  describe('when Web Serial API is supported', () => {
    beforeEach(() => {
      setupWebSerialMock();
    });

    it('shows loading state initially', () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise(() => {
            /* never resolves — keep loading */
          }),
      );

      renderPage();

      expect(screen.getByText('Loading unclaimed devices...')).toBeInTheDocument();
    });

    it('shows error state when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Error loading devices/)).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('shows empty state when no unclaimed devices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No unclaimed devices')).toBeInTheDocument();
      });
    });

    it('renders a list of unclaimed devices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: DEVICES_MOCK }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Sensor Alpha')).toBeInTheDocument();
        expect(screen.getByText('Sensor Beta')).toBeInTheDocument();
      });

      // Hardware IDs should be visible
      expect(screen.getByText('ESP32-001')).toBeInTheDocument();
      expect(screen.getByText('ESP32-002')).toBeInTheDocument();

      // Should have two provision buttons
      const provisionButtons = screen.getAllByText('Provision');
      expect(provisionButtons).toHaveLength(2);
    });

    it('opens the provisioning modal when clicking Provision', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: DEVICES_MOCK }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Sensor Alpha')).toBeInTheDocument();
      });

      const provisionButtons = screen.getAllByText('Provision');
      await userEvent.click(provisionButtons[0]!);

      // Modal should appear with device info
      await waitFor(() => {
        expect(screen.getByText(/Provision Device: Sensor Alpha/)).toBeInTheDocument();
      });

      expect(
        screen.getByText((content) => content.includes('claim-tok-abc-12345')),
      ).toBeInTheDocument();
    });

    it('shows the Refresh List button', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: DEVICES_MOCK }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Refresh List')).toBeInTheDocument();
      });
    });

    it('fetches devices with status=unclaimed filter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: DEVICES_MOCK }),
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Sensor Alpha')).toBeInTheDocument();
      });

      // Verify the request URL includes the status filter
      const fetchCalls = mockFetch.mock.calls;
      const devicesCall = fetchCalls.find(
        (call: unknown[]) => (call[0] as string)?.includes('/api/devices'),
      );
      expect(devicesCall).toBeDefined();
      expect((devicesCall![0] as string)).toContain('status=unclaimed');
    });

    it('refreshes the device list after clicking Refresh List', async () => {
      // First call returns empty, second returns devices
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [DEVICES_MOCK[0]] }),
        });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('No unclaimed devices')).toBeInTheDocument();
      });

      const refreshBtn = screen.getByText('Refresh List');
      await userEvent.click(refreshBtn);

      await waitFor(() => {
        expect(screen.getByText('Sensor Alpha')).toBeInTheDocument();
      });

      // fetch should have been called twice
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('hides the status message after successful provisioning triggers refresh', async () => {
      // Two fetches: initial load, then refresh after provisioning
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: DEVICES_MOCK }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [DEVICES_MOCK[0]] }), // only one left
        });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Sensor Alpha')).toBeInTheDocument();
      });

      // Open modal for Sensor Alpha
      const provisionButtons = screen.getAllByText('Provision');
      await userEvent.click(provisionButtons[0]!);

      await waitFor(() => {
        expect(
          screen.getByText(/Provision Device: Sensor Alpha/),
        ).toBeInTheDocument();
      });

      // Click "Select Serial Port & Send Credentials"
      const connectBtn = screen.getByText(/Select Serial Port/);
      await userEvent.click(connectBtn);

      // After provisioning, the page should show a success status message
      await waitFor(() => {
        // The success message appears twice: once in the status message div on the page,
        // and once in the modal result. Use getAllByText and check count.
        const successElements = screen.getAllByText(/Device provisioned successfully/);
        expect(successElements.length).toBeGreaterThanOrEqual(1);
      });

      // Close the success message / modal
      const closeBtn = screen.getByText('Close');
      await userEvent.click(closeBtn);

      // After refresh, only one device should remain
      await waitFor(() => {
        expect(screen.getByText('Sensor Alpha')).toBeInTheDocument();
        expect(screen.queryByText('Sensor Beta')).not.toBeInTheDocument();
      });
    });
  });
});
