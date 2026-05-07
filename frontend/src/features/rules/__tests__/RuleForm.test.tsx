import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleForm from '../RuleForm';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderForm(onSubmit = jest.fn()) {
  return render(<RuleForm onSubmit={onSubmit} />);
}

async function selectActionType(actionLabel: string) {
  const select = screen.getByLabelText('Action Type');
  await userEvent.selectOptions(select, actionLabel);
}

async function selectTriggerType(triggerLabel: string) {
  const select = screen.getByLabelText('Trigger Type');
  await userEvent.selectOptions(select, triggerLabel);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RuleForm', () => {
  describe('Action Type select', () => {
    it('renders all action type options including new charging types', () => {
      renderForm();

      const select = screen.getByLabelText('Action Type');
      const options = Array.from(select.querySelectorAll('option')).map(
        (opt) => (opt as HTMLOptionElement).label,
      );

      expect(options).toEqual(
        expect.arrayContaining([
          'Relay Control',
          'Send Command',
          'Start Charging',
          'Stop Charging',
          'Low Power Mode',
        ]),
      );
    });

    it('renders all trigger type options including battery_low', () => {
      renderForm();

      const select = screen.getByLabelText('Trigger Type');
      const options = Array.from(select.querySelectorAll('option')).map(
        (opt) => (opt as HTMLOptionElement).label,
      );

      expect(options).toEqual(
        expect.arrayContaining([
          'Threshold',
          'Status Match',
          'Battery Low',
        ]),
      );
    });
  });

  describe('Conditional fields for charging_start', () => {
    beforeEach(async () => {
      renderForm();
      await selectActionType('charging_start');
    });

    it('shows Target Device ID field when charging_start is selected', () => {
      expect(screen.getByLabelText('Target Device ID')).toBeInTheDocument();
    });

    it('does NOT show Duration (minutes) field for charging_start', () => {
      expect(screen.queryByLabelText('Duration (minutes)')).not.toBeInTheDocument();
    });

    it('shows Cooldown field (shared across all action types)', () => {
      expect(screen.getByLabelText('Cooldown (seconds)')).toBeInTheDocument();
    });
  });

  describe('Conditional fields for charging_stop', () => {
    beforeEach(async () => {
      renderForm();
      await selectActionType('charging_stop');
    });

    it('shows Target Device ID field when charging_stop is selected', () => {
      expect(screen.getByLabelText('Target Device ID')).toBeInTheDocument();
    });

    it('does NOT show Duration (minutes) field for charging_stop', () => {
      expect(screen.queryByLabelText('Duration (minutes)')).not.toBeInTheDocument();
    });
  });

  describe('Conditional fields for low_power_mode', () => {
    beforeEach(async () => {
      renderForm();
      await selectActionType('low_power_mode');
    });

    it('shows Target Device ID field when low_power_mode is selected', () => {
      expect(screen.getByLabelText('Target Device ID')).toBeInTheDocument();
    });

    it('shows Duration (minutes) field when low_power_mode is selected', () => {
      expect(screen.getByLabelText('Duration (minutes)')).toBeInTheDocument();
    });

    it('Cooldown field remains visible', () => {
      expect(screen.getByLabelText('Cooldown (seconds)')).toBeInTheDocument();
    });
  });

  describe('Conditional fields for battery_low trigger', () => {
    beforeEach(async () => {
      renderForm();
      await selectTriggerType('battery_low');
    });

    it('shows Battery Threshold field when battery_low is selected', () => {
      expect(screen.getByLabelText('Battery Threshold (%)')).toBeInTheDocument();
    });

    it('shows Telemetry Field select when battery_low is selected', () => {
      expect(screen.getByLabelText('Telemetry Field')).toBeInTheDocument();
    });
  });

  describe('Existing types still work (backward compatibility)', () => {
    it('shows relay fields when relay is selected', async () => {
      renderForm();
      await selectActionType('relay');

      expect(screen.getByLabelText('Relay Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Relay State')).toBeInTheDocument();
    });

    it('shows command field when command is selected', async () => {
      renderForm();
      await selectActionType('command');

      expect(screen.getByLabelText('Command')).toBeInTheDocument();
    });
  });
});
