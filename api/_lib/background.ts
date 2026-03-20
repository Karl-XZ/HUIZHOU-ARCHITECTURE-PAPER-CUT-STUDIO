import { waitUntil } from '@vercel/functions';

export function enqueueBackgroundTask(task: Promise<unknown>) {
  if (process.env.VERCEL) {
    waitUntil(task);
    return;
  }

  void task.catch((error) => {
    console.error('Background task failed:', error);
  });
}
