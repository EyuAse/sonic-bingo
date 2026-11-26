import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

let ioInstance: SocketIOServer | null = null;
type InternalEmitListener = (eventName: string, payload: any) => void;
const internalEmitListeners: InternalEmitListener[] = [];

export function registerInternalEmitListener(listener: InternalEmitListener): void {
  internalEmitListeners.push(listener);
}

function dispatchInternalListeners(eventName: string, payload: any): void {
  if (internalEmitListeners.length === 0) return;
  setImmediate(() => {
    for (const listener of internalEmitListeners) {
      try {
        listener(eventName, payload);
      } catch (err) {
        console.warn('⚠️ [Internal Emit Listener Error]:', err);
      }
    }
  });
}

export function initSocketIO(httpServer: HttpServer, corsOrigin: string = '*'): SocketIOServer {
  ioInstance = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 15000,
    transports: ['websocket', 'polling'],
    perMessageDeflate: {
      threshold: 512,
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 6,
        windowBits: 13
      },
      zlibInflateOptions: {
        windowBits: 13
      }
    }
  });
  return ioInstance;
}

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Authoritative Safe Proxy for Socket.IO Server
 * Prevents ES module circular dependency ReferenceErrors (TDZ)
 * and safely no-ops if invoked during initial module instantiation before HTTP server binds.
 */
export const io: SocketIOServer = new Proxy({} as SocketIOServer, {
  get(_target, prop: string | symbol) {
    if (!ioInstance) {
      if (prop === 'to' || prop === 'in') {
        return () => ({
          emit: () => false
        });
      }
      if (prop === 'emit') {
        return () => false;
      }
      if (prop === 'on') {
        return () => false;
      }
      return undefined;
    }
    const val = (ioInstance as any)[prop];
    if (prop === 'emit' && typeof val === 'function') {
      return (...args: any[]) => {
        const result = val.apply(ioInstance, args);
        dispatchInternalListeners(String(args[0] || ''), args[1]);
        return result;
      };
    }
    if (typeof val === 'function') {
      return val.bind(ioInstance);
    }
    return val;
  }
});
