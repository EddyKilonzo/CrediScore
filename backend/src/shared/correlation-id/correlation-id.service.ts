import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdService {
  private readonly storage = new AsyncLocalStorage<Map<string, string>>();

  run<T>(correlationId: string, fn: () => T): T {
    const store = new Map<string, string>();
    store.set('correlationId', correlationId);
    return this.storage.run(store, fn);
  }

  get correlationId(): string {
    return this.storage.getStore()?.get('correlationId') ?? randomUUID();
  }

  static generate(): string {
    return randomUUID();
  }
}
