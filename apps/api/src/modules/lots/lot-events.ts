import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();

emitter.setMaxListeners(1000);

export function publishLotUpdate(lotId: string): void {
  emitter.emit(lotId);
}

export function subscribeToLotUpdates(lotId: string, listener: () => void): () => void {
  emitter.on(lotId, listener);

  return () => {
    emitter.off(lotId, listener);
  };
}
