import React from 'react';
import type {
  ActionType,
  TriggerType,
  Rule,
  ActionConfig,
  TriggerConfig,
} from './rulesApi';
import {
  ACTION_TYPE_OPTIONS,
  TRIGGER_TYPE_OPTIONS,
} from './rulesApi';

// ── Props ─────────────────────────────────────────────────────────────────────

interface RuleFormProps {
  initialData?: Partial<Rule>;
  onSubmit: (data: Partial<Rule>) => void;
  onCancel?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARGING_ACTION_TYPES: ActionType[] = [
  'charging_start',
  'charging_stop',
  'low_power_mode',
];

const BATTERY_LOW_FIELDS = ['battery', 'battery_level'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function RuleForm({ initialData = {}, onSubmit, onCancel }: RuleFormProps) {
  const [actionType, setActionType] = React.useState<ActionType>(
    initialData.action_type ?? 'relay',
  );
  const [triggerType, setTriggerType] = React.useState<TriggerType>(
    initialData.trigger_type ?? 'threshold',
  );

  // ── Action config state ──────────────────────────────────────────────────
  const [relayNumber, setRelayNumber] = React.useState(
    (initialData.action_config as { relay?: number } | undefined)?.relay ?? 0,
  );
  const [relayState, setRelayState] = React.useState(
    (initialData.action_config as { state?: boolean } | undefined)?.state ?? false,
  );
  const [commandName, setCommandName] = React.useState(
    (initialData.action_config as { command?: string } | undefined)?.command ?? '',
  );
  const [deviceId, setDeviceId] = React.useState(
    (initialData.action_config as { deviceId?: string } | undefined)?.deviceId ?? '',
  );
  const [durationMinutes, setDurationMinutes] = React.useState<number | undefined>(
    (initialData.action_config as { duration_minutes?: number } | undefined)?.duration_minutes,
  );

  // ── Trigger config state ─────────────────────────────────────────────────
  const [thresholdField, setThresholdField] = React.useState(
    (initialData.trigger_config as { field?: string } | undefined)?.field ?? '',
  );
  const [thresholdOperator, setThresholdOperator] = React.useState(
    (initialData.trigger_config as { operator?: string } | undefined)?.operator ?? '>',
  );
  const [thresholdValue, setThresholdValue] = React.useState(
    (initialData.trigger_config as { value?: number } | undefined)?.value ?? 0,
  );
  const [statusField, setStatusField] = React.useState(
    (initialData.trigger_config as { field?: string } | undefined)?.field ?? '',
  );
  const [statusValue, setStatusValue] = React.useState(
    (initialData.trigger_config as { value?: string } | undefined)?.value ?? '',
  );
  const [batteryThreshold, setBatteryThreshold] = React.useState(
    (initialData.trigger_config as { threshold?: number } | undefined)?.threshold ?? 20,
  );
  const [batteryField, setBatteryField] = React.useState(
    (initialData.trigger_config as { field?: string } | undefined)?.field ?? 'battery',
  );

  // ── Common state ─────────────────────────────────────────────────────────
  const [name, setName] = React.useState(initialData.name ?? '');
  const [cooldown, setCooldown] = React.useState(initialData.cooldown ?? 0);

  // ── Build action config from state ───────────────────────────────────────
  function buildActionConfig(): ActionConfig {
    switch (actionType) {
      case 'relay':
        return { relay: relayNumber, state: relayState };
      case 'command':
        return { command: commandName };
      case 'charging_start':
      case 'charging_stop':
        return { deviceId };
      case 'low_power_mode': {
        const config: { deviceId: string; duration_minutes?: number } = { deviceId };
        if (durationMinutes !== undefined && durationMinutes > 0) {
          config.duration_minutes = durationMinutes;
        }
        return config;
      }
      default:
        return {};
    }
  }

  // ── Build trigger config from state ──────────────────────────────────────
  function buildTriggerConfig(): TriggerConfig {
    switch (triggerType) {
      case 'threshold':
        return { field: thresholdField, operator: thresholdOperator as '>' | '<' | '>=' | '<=' | '==' | '!=', value: thresholdValue };
      case 'status':
        return { field: statusField, value: statusValue };
      case 'battery_low':
        return { threshold: batteryThreshold, field: batteryField };
      default:
        return {};
    }
  }

  // ── Submit handler ───────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    onSubmit({
      name,
      action_type: actionType,
      action_config: buildActionConfig(),
      trigger_type: triggerType,
      trigger_config: buildTriggerConfig(),
      cooldown,
    });
  }

  // ── Determine if the current action type is a charging-related type ──────
  const isChargingAction = CHARGING_ACTION_TYPES.includes(actionType);
  const isLowPower = actionType === 'low_power_mode';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── Rule Name ─────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="rule-name" className="block text-sm font-medium text-gray-700">
          Rule Name
        </label>
        <input
          id="rule-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* ── Action Type ───────────────────────────────────────────────── */}
      <div>
        <label htmlFor="action-type" className="block text-sm font-medium text-gray-700">
          Action Type
        </label>
        <select
          id="action-type"
          value={actionType}
          onChange={(e) => setActionType(e.target.value as ActionType)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {ACTION_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Trigger Type ──────────────────────────────────────────────── */}
      <div>
        <label htmlFor="trigger-type" className="block text-sm font-medium text-gray-700">
          Trigger Type
        </label>
        <select
          id="trigger-type"
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value as TriggerType)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {TRIGGER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Conditional: Action config ────────────────────────────────── */}

      {/* Relay action config */}
      {actionType === 'relay' && (
        <>
          <div>
            <label htmlFor="relay-number" className="block text-sm font-medium text-gray-700">
              Relay Number
            </label>
            <input
              id="relay-number"
              type="number"
              min={0}
              value={relayNumber}
              onChange={(e) => setRelayNumber(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="relay-state" className="block text-sm font-medium text-gray-700">
              Relay State
            </label>
            <select
              id="relay-state"
              value={String(relayState)}
              onChange={(e) => setRelayState(e.target.value === 'true')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="true">ON</option>
              <option value="false">OFF</option>
            </select>
          </div>
        </>
      )}

      {/* Command action config */}
      {actionType === 'command' && (
        <div>
          <label htmlFor="command-name" className="block text-sm font-medium text-gray-700">
            Command
          </label>
          <input
            id="command-name"
            type="text"
            value={commandName}
            onChange={(e) => setCommandName(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Charging / Low Power action config */}
      {isChargingAction && (
        <div>
          <label htmlFor="target-device-id" className="block text-sm font-medium text-gray-700">
            Target Device ID
          </label>
          <input
            id="target-device-id"
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            required
            placeholder="e.g. dev-001"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Low power mode: optional duration */}
      {isLowPower && (
        <div>
          <label htmlFor="duration-minutes" className="block text-sm font-medium text-gray-700">
            Duration (minutes)
          </label>
          <input
            id="duration-minutes"
            type="number"
            min={1}
            value={durationMinutes ?? ''}
            onChange={(e) =>
              setDurationMinutes(e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="Optional"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* ── Conditional: Trigger config ───────────────────────────────── */}

      {/* Threshold trigger config */}
      {triggerType === 'threshold' && (
        <>
          <div>
            <label htmlFor="threshold-field" className="block text-sm font-medium text-gray-700">
              Telemetry Field
            </label>
            <input
              id="threshold-field"
              type="text"
              value={thresholdField}
              onChange={(e) => setThresholdField(e.target.value)}
              required
              placeholder="e.g. temperature"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="threshold-operator" className="block text-sm font-medium text-gray-700">
              Operator
            </label>
            <select
              id="threshold-operator"
              value={thresholdOperator}
              onChange={(e) => setThresholdOperator(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="==">==</option>
              <option value="!=">!=</option>
            </select>
          </div>
          <div>
            <label htmlFor="threshold-value" className="block text-sm font-medium text-gray-700">
              Value
            </label>
            <input
              id="threshold-value"
              type="number"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(Number(e.target.value))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      {/* Status trigger config */}
      {triggerType === 'status' && (
        <>
          <div>
            <label htmlFor="status-field" className="block text-sm font-medium text-gray-700">
              Telemetry Field
            </label>
            <input
              id="status-field"
              type="text"
              value={statusField}
              onChange={(e) => setStatusField(e.target.value)}
              required
              placeholder="e.g. motion"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="status-value" className="block text-sm font-medium text-gray-700">
              Expected Value
            </label>
            <input
              id="status-value"
              type="text"
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value)}
              required
              placeholder="e.g. detected"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </>
      )}

      {/* Battery low trigger config */}
      {triggerType === 'battery_low' && (
        <>
          <div>
            <label htmlFor="battery-threshold" className="block text-sm font-medium text-gray-700">
              Battery Threshold (%)
            </label>
            <input
              id="battery-threshold"
              type="number"
              min={0}
              max={100}
              value={batteryThreshold}
              onChange={(e) => setBatteryThreshold(Number(e.target.value))}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="battery-field" className="block text-sm font-medium text-gray-700">
              Telemetry Field
            </label>
            <select
              id="battery-field"
              value={batteryField}
              onChange={(e) => setBatteryField(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {BATTERY_LOW_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* ── Cooldown ──────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="cooldown" className="block text-sm font-medium text-gray-700">
          Cooldown (seconds)
        </label>
        <input
          id="cooldown"
          type="number"
          min={0}
          value={cooldown}
          onChange={(e) => setCooldown(Number(e.target.value))}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* ── Buttons ───────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Save Rule
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
