'use strict';

/**
 * Unit tests for firmware.service.js — CRUD + duplicate version+model + OTA.
 */

jest.mock('../firmware.model');
jest.mock('../../../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../mqtt/mqttClient');

const firmwareModel = require('../firmware.model');
const firmwareService = require('../firmware.service');
const { getClient: getMqttClient } = require('../../../mqtt/mqttClient');
const { NotFoundError, ConflictError } = require('../../../shared/errors');

const TENANT_ID = 'tenant-uuid-1';
const FIRMWARE_ID = 'fw-uuid-1';
const DEVICE_ID = 'device-uuid-1';

function makeFirmware(overrides = {}) {
  return {
    id: FIRMWARE_ID,
    tenant_id: TENANT_ID,
    version: '1.0.0',
    hardware_model: 'ESP32-S3',
    release_notes: 'Initial release',
    download_url: 'https://cdn.example.com/fw/1.0.0.bin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('firmwareService.create()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a firmware record and returns it', async () => {
    firmwareModel.findByVersionAndModel.mockResolvedValue(null);
    firmwareModel.insert.mockResolvedValue(makeFirmware());

    const result = await firmwareService.create(TENANT_ID, {
      version: '1.0.0',
      hardware_model: 'ESP32-S3',
      download_url: 'https://cdn.example.com/fw/1.0.0.bin',
    });

    expect(result).toMatchObject({ version: '1.0.0', hardware_model: 'ESP32-S3' });
  });

  it('throws ConflictError when version+model already exists', async () => {
    firmwareModel.findByVersionAndModel.mockResolvedValue(makeFirmware());

    await expect(
      firmwareService.create(TENANT_ID, { version: '1.0.0', hardware_model: 'ESP32-S3', download_url: 'url' })
    ).rejects.toThrow(ConflictError);

    expect(firmwareModel.insert).not.toHaveBeenCalled();
  });
});

describe('firmwareService.list()', () => {
  it('returns all firmware records for the tenant', async () => {
    firmwareModel.findAll.mockResolvedValue([makeFirmware()]);

    const result = await firmwareService.list(TENANT_ID);

    expect(firmwareModel.findAll).toHaveBeenCalledWith(TENANT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('1.0.0');
  });
});

describe('firmwareService.getById()', () => {
  it('returns the firmware record when found', async () => {
    firmwareModel.findById.mockResolvedValue(makeFirmware());

    const result = await firmwareService.getById(TENANT_ID, FIRMWARE_ID);

    expect(result).toMatchObject({ id: FIRMWARE_ID });
  });

  it('throws NotFoundError when firmware does not exist', async () => {
    firmwareModel.findById.mockResolvedValue(null);

    await expect(firmwareService.getById(TENANT_ID, 'nonexistent')).rejects.toThrow(NotFoundError);
  });
});

describe('firmwareService.update()', () => {
  it('updates an existing firmware record', async () => {
    firmwareModel.findById.mockResolvedValue(makeFirmware());
    firmwareModel.update.mockResolvedValue(makeFirmware({ release_notes: 'Updated' }));

    const result = await firmwareService.update(TENANT_ID, FIRMWARE_ID, { release_notes: 'Updated' });

    expect(result.release_notes).toBe('Updated');
  });

  it('throws NotFoundError when firmware does not exist on update', async () => {
    firmwareModel.findById.mockResolvedValue(null);

    await expect(firmwareService.update(TENANT_ID, 'bad-id', {})).rejects.toThrow(NotFoundError);
  });
});

describe('firmwareService.remove()', () => {
  it('deletes a firmware record', async () => {
    firmwareModel.findById.mockResolvedValue(makeFirmware());
    firmwareModel.remove.mockResolvedValue(1);

    await expect(firmwareService.remove(TENANT_ID, FIRMWARE_ID)).resolves.toBeUndefined();
    expect(firmwareModel.remove).toHaveBeenCalledWith(FIRMWARE_ID);
  });

  it('throws NotFoundError when firmware does not exist on delete', async () => {
    firmwareModel.findById.mockResolvedValue(null);

    await expect(firmwareService.remove(TENANT_ID, 'bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ─── checkLatest() ─────────────────────────────────────────────────────────

describe('firmwareService.checkLatest()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns { version, url } when a newer version exists', async () => {
    firmwareModel.findLatestByHardwareModel.mockResolvedValue({
      version: '2.0.0',
      download_url: 'https://cdn.example.com/fw/2.0.0.bin',
    });

    const result = await firmwareService.checkLatest('1.0.0', 'ESP32-S3');

    expect(result).toEqual({
      version: '2.0.0',
      url: 'https://cdn.example.com/fw/2.0.0.bin',
    });
  });

  it('returns { upToDate: true } when device is already at the latest version', async () => {
    firmwareModel.findLatestByHardwareModel.mockResolvedValue({
      version: '2.0.0',
      download_url: 'https://cdn.example.com/fw/2.0.0.bin',
    });

    const result = await firmwareService.checkLatest('2.0.0', 'ESP32-S3');

    expect(result).toEqual({ upToDate: true });
  });

  it('returns { upToDate: true } when no firmware exists for the hardware_model', async () => {
    firmwareModel.findLatestByHardwareModel.mockResolvedValue(undefined);

    const result = await firmwareService.checkLatest('1.0.0', 'nonexistent-model');

    expect(result).toEqual({ upToDate: true });
  });

  it('throws NotFoundError when hardware_model is empty', async () => {
    await expect(firmwareService.checkLatest('1.0.0', '')).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when hardware_model is missing', async () => {
    await expect(firmwareService.checkLatest('1.0.0', undefined)).rejects.toThrow(NotFoundError);
  });
});

// ─── checkLatest() — in test above ─────────────────────────────────────────
