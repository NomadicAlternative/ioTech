'use strict';

/**
 * Unit tests for firmware.service.js — CRUD + duplicate version+model.
 */

jest.mock('../firmware.model');
jest.mock('../../../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const firmwareModel = require('../firmware.model');
const firmwareService = require('../firmware.service');
const { NotFoundError, ConflictError } = require('../../../shared/errors');

const TENANT_ID = 'tenant-uuid-1';
const FIRMWARE_ID = 'fw-uuid-1';

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
