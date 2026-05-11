'use strict';

/**
 * Unit tests for firmware.model.js
 */

jest.mock('../../../shared/db/knex');
const db = require('../../../shared/db/knex');
const firmwareModel = require('../firmware.model');

describe('firmwareModel.findLatestByHardwareModel()', () => {
  let mockFirst;
  let mockOrderBy;
  let mockWhere;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirst = jest.fn();
    mockOrderBy = jest.fn().mockReturnValue({ first: mockFirst });
    mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
  });

  it('returns the highest version firmware for a given hardware_model', async () => {
    const latest = { version: '2.0.0', download_url: 'https://cdn.example.com/fw/2.0.0.bin' };
    mockFirst.mockResolvedValue(latest);
    db.mockReturnValue({ where: mockWhere });

    const result = await firmwareModel.findLatestByHardwareModel('ESP32-S3');

    expect(db).toHaveBeenCalledWith('firmware_versions');
    expect(mockWhere).toHaveBeenCalledWith({ hardware_model: 'ESP32-S3' });
    expect(result).toEqual(latest);
  });

  it('returns undefined when no firmware exists for the hardware_model', async () => {
    mockFirst.mockResolvedValue(undefined);
    db.mockReturnValue({ where: mockWhere });

    const result = await firmwareModel.findLatestByHardwareModel('nonexistent-model');

    expect(result).toBeUndefined();
  });

  it('orders by version descending to get the latest', async () => {
    mockFirst.mockResolvedValue({ version: '1.0.0' });
    db.mockReturnValue({ where: mockWhere });

    await firmwareModel.findLatestByHardwareModel('ESP32-S3');

    expect(mockOrderBy).toHaveBeenCalledWith('version', 'desc');
  });
});
