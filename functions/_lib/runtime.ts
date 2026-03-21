export interface CloudflareKvNamespace {
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
  ): Promise<void>;
  get(
    key: string,
    options?: 'text' | 'json' | 'arrayBuffer' | 'stream' | { type?: string },
  ): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    complete: boolean;
    cursor: string | null;
    keys: Array<{ key: string }>;
  }>;
}

export interface CloudflarePagesContext {
  request: Request;
  params?: Record<string, string>;
  env?: Record<string, unknown>;
  waitUntil?: (task: Promise<unknown>) => void;
}

export function getBinding<T>(context: CloudflarePagesContext, name: string): T | undefined {
  const fromContext = context.env?.[name];
  if (fromContext !== undefined) {
    return fromContext as T;
  }

  const scope = globalThis as typeof globalThis & Record<string, unknown>;
  const fromGlobal = scope[name];
  return fromGlobal as T | undefined;
}

export function getEnvString(
  context: CloudflarePagesContext,
  name: string,
): string | undefined {
  const fromBinding = getBinding<unknown>(context, name);
  if (typeof fromBinding === 'string' && fromBinding.trim()) {
    return fromBinding.trim();
  }

  const scope = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  if (scope.process?.env?.[name]) {
    return scope.process.env[name];
  }

  return undefined;
}

export function enqueueBackgroundTask(
  context: CloudflarePagesContext,
  task: Promise<unknown>,
) {
  if (typeof context.waitUntil === 'function') {
    context.waitUntil(task);
    return;
  }

  void task.catch((error) => {
    console.error('Background task failed:', error);
  });
}
