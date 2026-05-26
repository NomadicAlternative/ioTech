'use strict';

/**
 * Unit tests for socketServer.js
 *
 * Tests:
 * - initSocket() sets up auth middleware and connection handler
 * - subscribe:device with device owned by tenant → socket joins device room
 * - subscribe:device with device owned by other tenant → socket does NOT join
 * - subscribe:device with unknown device → socket does NOT join
 * - emitTelemetry() broadcasts telemetry:new to the correct device room
 * - emitTelemetry() completes without error when no subscribers
 */

// Mock socket.io Server
jest.mock('socket.io');
const { Server } = require('socket.io');

// Mock socketMiddleware
jest.mock('../socketMiddleware');
const { createAuthMiddleware } = require('../socketMiddleware');

// Mock the DB (knex) for device ownership validation
jest.mock('../../shared/db/knex');
const db = require('../../shared/db/knex');

const { initSocket, getSocketService } = require('../socketServer');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeIo() {
  // Current implementation uses single chain: io.to(room).emit(event, payload)
  const chain = {
    emit: jest.fn(),
  };

  const io = {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn().mockReturnValue(chain),
    _chain: chain,
  };

  return io;
}

function makeSocket(tenantId = 't1', _deviceId = null) {
  const socket = {
    data: { userId: 'u1', tenantId },
    join: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    id: 'socket-id-1',
  };
  return socket;
}

describe('initSocket()', () => {
  let mockIo;
  let mockHttpServer;
  let capturedConnectionHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = makeIo();
    mockHttpServer = {};

    // createAuthMiddleware returns a mock fn
    createAuthMiddleware.mockReturnValue(jest.fn());

    // Server constructor returns our mock io
    Server.mockImplementation(() => mockIo);

    // Capture the 'connection' event handler
    mockIo.on.mockImplementation((event, handler) => {
      if (event === 'connection') capturedConnectionHandler = handler;
    });

    initSocket(mockHttpServer);
  });

  it('applies auth middleware', () => {
    expect(createAuthMiddleware).toHaveBeenCalled();
    expect(mockIo.use).toHaveBeenCalled();
  });

  it('registers connection event handler', () => {
    expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });

  it('auto-joins socket to tenant room on connection', () => {
    const socket = makeSocket('t1');
    capturedConnectionHandler(socket);

    expect(socket.join).toHaveBeenCalledWith('tenant:t1');
  });
});

describe('subscribe:device handler', () => {
  let mockIo;
  let capturedConnectionHandler;
  let socket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = makeIo();
    const mockHttpServer = {};

    createAuthMiddleware.mockReturnValue(jest.fn());
    Server.mockImplementation(() => mockIo);

    mockIo.on.mockImplementation((event, handler) => {
      if (event === 'connection') capturedConnectionHandler = handler;
    });

    socket = makeSocket('t1');

    initSocket(mockHttpServer);
    capturedConnectionHandler(socket);
  });

  it('joins device room when device is owned by the socket tenant', async () => {
    // Capture the 'subscribe:device' handler
    let subscribeHandler;
    socket.on.mockImplementation((event, handler) => {
      if (event === 'subscribe:device') subscribeHandler = handler;
    });

    // Re-trigger connection to register handlers
    socket = makeSocket('t1');
    capturedConnectionHandler(socket);

    // Mock DB: device belongs to tenant t1
    db.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 'd1', tenant_id: 't1' }),
    });

    socket.on.mock.calls.forEach(([event, handler]) => {
      if (event === 'subscribe:device') subscribeHandler = handler;
    });

    await subscribeHandler({ deviceId: 'd1' });

    expect(socket.join).toHaveBeenCalledWith('device:d1');
    expect(socket.emit).toHaveBeenCalledWith('subscribed', { deviceId: 'd1' });
  });

  it('does NOT join device room when device belongs to a different tenant', async () => {
    let subscribeHandler;
    socket = makeSocket('t1');
    capturedConnectionHandler(socket);

    // Mock DB: device belongs to tenant t2 (not t1) — returns undefined (no match)
    db.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    });

    socket.on.mock.calls.forEach(([event, handler]) => {
      if (event === 'subscribe:device') subscribeHandler = handler;
    });

    await subscribeHandler({ deviceId: 'd2' });

    const joinCalls = socket.join.mock.calls.map(([r]) => r);
    expect(joinCalls).not.toContain('device:d2');
  });

  it('emits error when device is not found', async () => {
    let subscribeHandler;
    socket = makeSocket('t1');
    capturedConnectionHandler(socket);

    db.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined),
    });

    socket.on.mock.calls.forEach(([event, handler]) => {
      if (event === 'subscribe:device') subscribeHandler = handler;
    });

    await subscribeHandler({ deviceId: 'unknown-id' });

    expect(socket.emit).toHaveBeenCalledWith(
      'error',
      expect.objectContaining({ code: 'DEVICE_NOT_FOUND' })
    );
  });
});

describe('emitTelemetry()', () => {
  let mockIo;
  let socketService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = makeIo();
    const mockHttpServer = {};

    createAuthMiddleware.mockReturnValue(jest.fn());
    Server.mockImplementation(() => mockIo);
    mockIo.on.mockImplementation(jest.fn());

    initSocket(mockHttpServer);
    socketService = getSocketService();
  });

  it('emits telemetry:new to the correct tenant room', () => {
    const payload = {
      id: 'row1',
      deviceId: 'd1',
      data: { temp: 22 },
      receivedAt: '2026-01-01T00:00:00Z',
    };

    socketService.emitTelemetry('t1', 'd1', payload.data, payload.receivedAt, payload.id);

    expect(mockIo.to).toHaveBeenCalledWith('tenant:t1');
    expect(mockIo._chain.emit).toHaveBeenCalledWith('telemetry:new', {
      id: 'row1',
      deviceId: 'd1',
      data: payload.data,
      receivedAt: payload.receivedAt,
    });
  });

  it('completes without error when no subscribers (fire-and-forget)', () => {
    // If no clients are subscribed, socket.io simply emits to an empty room — no error
    expect(() => {
      socketService.emitTelemetry('t99', 'd99', { val: 1 }, '2026-01-01T00:00:00Z', 'r1');
    }).not.toThrow();
  });
});
