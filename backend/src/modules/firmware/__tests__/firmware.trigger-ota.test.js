'use strict';

/**
 * Unit tests for firmwareService.triggerOta()
 *
 * Mock strategy: mock all DB/model dependencies at the top level so
 * jest.mock() hoisting works correctly. The firmware model, devices model,
 * device-templates model, and mqtt client are all mocked.
 */

jest.mock('../firmware.model');
jest.mock('../../devices/devices.model');
jest.mock('../../device-templates/device-templates.model');
jest.mock('../../../mqtt/mqttClient');
jest.mock('../../../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const firmwareModel = require('../firmware.model');
const devicesModel = require('../../devices/devices.model');
const templatesModel = require('../../device-templates/device-templates.model');
const { getClient: getMqttClient } = require('../../../mqtt/mqttClient');
const firmwareService = require('../firmware.service');
const { NotFoundError } = require('../../../shared/errors');

const TENANT_ID = 'tenant-uuid-1';
const DEVICE_ID = 'device-uuid-1';
const TEMPLATE_ID = 'tmpl-uuid-1';

describe('firmwareService.triggerOta()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes MQTT and returns firmware details on successful trigger', async () => {
    const mockMqtt = { publish: jest.fn() };
    getMqttClient.mockReturnValue(mockMqtt);

    devicesModel.findById.mockResolvedValue({
      id: DEVICE_ID,
      tenant_id: TENANT_ID,
      template_id: TEMPLATE_ID,
      firmware_version: '1.0.0',
    });
    templatesModel.findById.mockResolvedValue({
      id: TEMPLATE_ID,
      tenant_id: TENANT_ID,
      hardware_model: 'ESP32-S3',
    });
    firmwareModel.findLatestByHardwareModel.mockResolvedValue({
      version: '2.0.0',
      download_url: 'https://cdn.example.com/fw/2.0.0.bin',
    });
    devicesModel.update.mockResolvedValue({ firmware_version: '2.0.0' });

    const result = await firmwareService.triggerOta(TENANT_ID, DEVICE_ID);

    expect(result).toMatchObject({
      ok: true,
      firmware: {
        version: '2.0.0',
        url: 'https://cdn.example.com/fw/2.0.0.bin',
      },
    });
    expect(mockMqtt.publish).toHaveBeenCalledWith(
      `org/${TENANT_ID}/device/${DEVICE_ID}/ota/notify`,
      JSON.stringify({ version: '2.0.0', url: 'https://cdn.example.com/fw/2.0.0.bin' }),
      { qos: 1 }
    );
    expect(devicesModel.update).toHaveBeenCalledWith(DEVICE_ID, { firmware_version: '2.0.0' });
  });

  it('throws NotFoundError when device does not exist', async () => {
    devicesModel.findById.mockResolvedValue(null);

    await expect(firmwareService.triggerOta(TENANT_ID, 'bad-device')).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when device template has no hardware_model', async () => {
    getMqttClient.mockReturnValue({ publish: jest.fn() });
    devicesModel.findById.mockResolvedValue({
      id: DEVICE_ID,
      tenant_id: TENANT_ID,
      template_id: TEMPLATE_ID,
    });
    templatesModel.findById.mockResolvedValue({
      id: TEMPLATE_ID,
      tenant_id: TENANT_ID,
      hardware_model: null,
    });

    await expect(firmwareService.triggerOta(TENANT_ID, DEVICE_ID)).rejects.toThrow('template_missing_hardware_model');
  });

  it('throws NotFoundError when no firmware found for hardware_model', async () => {
    getMqttClient.mockReturnValue({ publish: jest.fn() });
    devicesModel.findById.mockResolvedValue({
      id: DEVICE_ID,
      tenant_id: TENANT_ID,
      template_id: TEMPLATE_ID,
    });
    templatesModel.findById.mockResolvedValue({
      id: TEMPLATE_ID,
      tenant_id: TENANT_ID,
      hardware_model: 'ESP32-S3',
    });
    firmwareModel.findLatestByHardwareModel.mockResolvedValue(undefined);

    await expect(firmwareService.triggerOta(TENANT_ID, DEVICE_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError (503 wrapper) when MQTT client is not connected', async () => {
    getMqttClient.mockReturnValue(null);
    devicesModel.findById.mockResolvedValue({
      id: DEVICE_ID,
      tenant_id: TENANT_ID,
      template_id: TEMPLATE_ID,
    });
    templatesModel.findById.mockResolvedValue({
      id: TEMPLATE_ID,
      tenant_id: TENANT_ID,
      hardware_model: 'ESP32-S3',
    });
    firmwareModel.findLatestByHardwareModel.mockResolvedValue({
      version: '2.0.0',
      download_url: 'https://cdn.example.com/fw/2.0.0.bin',
    });

    await expect(firmwareService.triggerOta(TENANT_ID, DEVICE_ID)).rejects.toThrow('mqtt_unavailable');
  });
});
