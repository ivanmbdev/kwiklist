import { ShoppingList } from './types';

const QUEUE_KEY = 'kwiklist_queue';
const CACHE_KEY = 'kwiklist_lists_cache';

export interface QueuedOperation {
  id: string;
  type: 'addItem' | 'toggleItem' | 'deleteItem' | 'deleteList' | 'leaveList' | 'updateListName';
  payload: Record<string, unknown>;
  timestamp: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export function getQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(type: QueuedOperation['type'], payload: Record<string, unknown>) {
  const queue = getQueue();
  queue.push({ id: generateId(), type, payload, timestamp: Date.now() });
  saveQueue(queue);
}

function removeFromQueue(opId: string) {
  const queue = getQueue().filter((op) => op.id !== opId);
  saveQueue(queue);
}

export function isNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    return code === 'ERR_NETWORK' || code === 'ECONNABORTED';
  }
  if (error && typeof error === 'object' && 'response' in error) {
    return !(error as { response?: unknown }).response;
  }
  return false;
}

export async function flush(
  executor: (op: QueuedOperation) => Promise<void>,
): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let executed = 0;
  for (const op of queue) {
    try {
      await executor(op);
      removeFromQueue(op.id);
      executed++;
    } catch {
      break;
    }
  }
  return executed;
}

export function cacheListsLocally(lists: ShoppingList[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(lists));
  } catch {
    // localStorage lleno, no es crítico
  }
}

export function getCachedLists(): ShoppingList[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
