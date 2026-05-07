import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProvisioningResult {
  success: boolean;
  message: string;
  deviceId?: string;
}

interface ProvisioningModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceName: string;
  deviceId: string;
  claimToken: string;
  hardwareId: string | null;
  onResult: (result: ProvisioningResult) => void;
}

// ── Web Serial helpers ────────────────────────────────────────────────────────

declare global {
  interface Navigator {
    serial: Serial;
  }
}

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPort {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  getInfo(): SerialPortInfo;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface Serial extends EventTarget {
  requestPort(options?: {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
  }): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProvisioningModal({
  isOpen,
  onClose,
  deviceName,
  deviceId,
  claimToken,
  hardwareId,
  onResult,
}: ProvisioningModalProps) {
  const [step, setStep] = React.useState<'connect' | 'sending' | 'result'>('connect');
  const [log, setLog] = React.useState<string[]>([]);
  const [port, setPort] = React.useState<SerialPort | null>(null);
  const [result, setResult] = React.useState<ProvisioningResult | null>(null);
  const [hasReported, setHasReported] = React.useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('connect');
      setLog([]);
      setPort(null);
      setResult(null);
      setHasReported(false);
    }
  }, [isOpen]);

  function addLog(message: string) {
    setLog((prev) => [...prev, message]);
  }

  async function handleConnect() {
    try {
      addLog('Requesting serial port...');
      const serialPort = await navigator.serial.requestPort();
      addLog('Opening port at 115200 baud...');
      await serialPort.open({ baudRate: 115200 });
      setPort(serialPort);
      addLog('Port opened successfully. Sending credentials...');
      setStep('sending');

      // Send credentials over serial
      await sendCredentials(serialPort, deviceId, claimToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      addLog(`Error: ${message}`);
      setResult({ success: false, message });
      setStep('result');
    }
  }

  async function sendCredentials(
    serialPort: SerialPort,
    id: string,
    token: string,
  ) {
    const writer = serialPort.writable.getWriter();
    const encoder = new TextEncoder();

    try {
      // Send device ID + claim token as JSON line
      const payload = JSON.stringify({
        cmd: 'provision',
        deviceId: id,
        claimToken: token,
      });
      addLog(`Sending: ${payload}`);

      await writer.write(encoder.encode(payload + '\n'));
      addLog('Credentials sent successfully!');

      // Wait for device acknowledgment
      const reader = serialPort.readable.getReader();
      const decoder = new TextDecoder();

      try {
        const { value, done } = await reader.read();
        if (done) {
          addLog('Device closed the connection');
          setResult({ success: true, message: 'Credentials sent, but no acknowledgment received', deviceId: id });
          setStep('result');
          return;
        }

        const response = decoder.decode(value, { stream: true });
        addLog(`Device response: ${response.trim()}`);

        const parsed = JSON.parse(response.trim());
        if (parsed.ok) {
          setResult({ success: true, message: parsed.message || 'Device provisioned successfully', deviceId: id });
        } else {
          setResult({ success: false, message: parsed.error || 'Device rejected provisioning' });
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send credentials';
      addLog(`Error: ${message}`);
      setResult({ success: false, message });
    } finally {
      writer.releaseLock();
      setStep('result');
    }
  }

  async function handleClose() {
    if (port) {
      try {
        await port.close();
      } catch {
        // Ignore close errors
      }
    }
    onClose();
  }

  // ── Effect: report result to parent once, when it becomes available ─────────
  React.useEffect(() => {
    if (result && !hasReported) {
      setHasReported(true);
      onResult(result);
    }
  }, [result, hasReported, onResult]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Provision Device: {deviceName}
          </h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Device info ────────────────────────────────────────────────── */}
        <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
          <p><span className="font-medium">Device ID:</span> {deviceId}</p>
          {hardwareId && (
            <p><span className="font-medium">Hardware ID:</span> {hardwareId}</p>
          )}
          <p><span className="font-medium">Claim Token:</span> {claimToken}</p>
        </div>

        {/* ── Log output ─────────────────────────────────────────────────── */}
        <div className="mb-4 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-gray-900 p-3 font-mono text-xs text-green-400">
          {log.length === 0 ? (
            <span className="text-gray-500">Ready to connect...</span>
          ) : (
            log.map((line, i) => (
              <div key={i} className="leading-relaxed">
                {'>'} {line}
              </div>
            ))
          )}
        </div>

        {/* ── Connect button / Result ────────────────────────────────────── */}
        {step === 'connect' && (
          <button
            onClick={handleConnect}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Select Serial Port &amp; Send Credentials
          </button>
        )}

        {step === 'sending' && (
          <div className="flex items-center justify-center py-2 text-sm text-gray-500">
            <svg className="mr-2 h-5 w-5 animate-spin text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending credentials...
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-3">
            <div
              className={`rounded-md p-3 text-sm ${
                result.success
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {result.success ? '✓ ' : '✗ '}
              {result.message}
            </div>
            <button
              onClick={handleClose}
              className="w-full rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
