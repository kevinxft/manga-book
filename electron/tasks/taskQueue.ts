import { randomUUID } from 'node:crypto';
import type { ScanTaskEvent } from '@shared/types';

export interface TaskProgress {
  current: number;
  total: number;
  message: string;
  sourceCurrent?: number;
  sourceTotal?: number;
  sourceName?: string;
  itemCurrent?: number;
  itemTotal?: number;
  currentItemName?: string;
}

export interface QueueTask {
  name: string;
  run: (signal: AbortSignal, reportProgress: (progress: TaskProgress) => void) => Promise<void>;
}

interface TaskState {
  id: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: TaskProgress;
  error?: string;
}

interface InternalTask {
  state: TaskState;
  controller: AbortController;
  run: QueueTask['run'];
}

export class TaskQueue {
  private readonly concurrency: number;
  private readonly queue: InternalTask[] = [];
  private readonly tasks = new Map<string, InternalTask>();
  private readonly listeners = new Set<(task: ScanTaskEvent) => void>();
  private runningCount = 0;

  constructor(concurrency = 4) {
    this.concurrency = concurrency;
  }

  enqueue(task: QueueTask): string {
    const id = randomUUID();
    const state: TaskState = {
      id,
      name: task.name,
      status: 'queued',
      progress: {
        current: 0,
        total: 0,
        message: 'Queued',
        sourceCurrent: 0,
        sourceTotal: 0,
        sourceName: '',
        itemCurrent: 0,
        itemTotal: 0,
        currentItemName: ''
      }
    };

    const internalTask: InternalTask = {
      state,
      controller: new AbortController(),
      run: task.run
    };

    this.tasks.set(id, internalTask);
    this.queue.push(internalTask);
    this.emitTaskUpdate(state);
    this.drain();

    return id;
  }

  onTaskUpdate(listener: (task: ScanTaskEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.controller.abort();

    if (task.state.status === 'queued') {
      task.state.status = 'cancelled';
      task.state.progress = {
        ...task.state.progress,
        message: 'Cancelled before start'
      };
      this.emitTaskUpdate(task.state);
      const index = this.queue.findIndex((item) => item.state.id === taskId);
      if (index >= 0) {
        this.queue.splice(index, 1);
      }
    }

    return true;
  }

  getTask(taskId: string): TaskState | null {
    return this.tasks.get(taskId)?.state ?? null;
  }

  getActiveTask(): TaskState | null {
    const running = Array.from(this.tasks.values()).find((task) => task.state.status === 'running');
    if (running) {
      return running.state;
    }

    const queued = this.queue.find((task) => task.state.status === 'queued');
    return queued?.state ?? null;
  }

  getRunningTask(): TaskState | null {
    const running = Array.from(this.tasks.values()).find((task) => task.state.status === 'running');
    return running?.state ?? null;
  }

  private drain(): void {
    while (this.runningCount < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task || task.state.status === 'cancelled') {
        continue;
      }

      this.execute(task).catch(() => {
        // Errors are already stored in task state.
      });
    }
  }

  private async execute(task: InternalTask): Promise<void> {
    this.runningCount += 1;
    task.state.status = 'running';
    task.state.progress = {
      ...task.state.progress,
      message: 'Running'
    };
    this.emitTaskUpdate(task.state);

    try {
      await task.run(task.controller.signal, (progress) => {
        task.state.progress = progress;
        this.emitTaskUpdate(task.state);
      });

      if (task.controller.signal.aborted) {
        task.state.status = 'cancelled';
        task.state.progress = {
          ...task.state.progress,
          message: 'Cancelled'
        };
        this.emitTaskUpdate(task.state);
      } else {
        task.state.status = 'completed';
        task.state.progress = {
          ...task.state.progress,
          message: 'Completed'
        };
        this.emitTaskUpdate(task.state);
      }
    } catch (error) {
      task.state.status = task.controller.signal.aborted ? 'cancelled' : 'failed';
      task.state.error = error instanceof Error ? error.message : 'Unknown task error';
      task.state.progress = {
        ...task.state.progress,
        message: task.state.status === 'cancelled' ? 'Cancelled' : 'Failed'
      };
      this.emitTaskUpdate(task.state);
    } finally {
      this.runningCount -= 1;
      this.drain();
    }
  }

  private emitTaskUpdate(task: TaskState): void {
    const payload: ScanTaskEvent = {
      taskId: task.id,
      status: task.status,
      current: task.progress.current,
      total: task.progress.total,
      message: task.progress.message,
      sourceCurrent: task.progress.sourceCurrent ?? 0,
      sourceTotal: task.progress.sourceTotal ?? 0,
      sourceName: task.progress.sourceName ?? '',
      itemCurrent: task.progress.itemCurrent ?? 0,
      itemTotal: task.progress.itemTotal ?? 0,
      currentItemName: task.progress.currentItemName ?? '',
      ...(task.error ? { error: task.error } : {})
    };

    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
