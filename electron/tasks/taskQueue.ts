import { randomUUID } from 'node:crypto';

export interface TaskProgress {
  current: number;
  total: number;
  message: string;
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
        message: 'Queued'
      }
    };

    const internalTask: InternalTask = {
      state,
      controller: new AbortController(),
      run: task.run
    };

    this.tasks.set(id, internalTask);
    this.queue.push(internalTask);
    this.drain();

    return id;
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

    try {
      await task.run(task.controller.signal, (progress) => {
        task.state.progress = progress;
      });

      if (task.controller.signal.aborted) {
        task.state.status = 'cancelled';
        task.state.progress = {
          ...task.state.progress,
          message: 'Cancelled'
        };
      } else {
        task.state.status = 'completed';
        task.state.progress = {
          ...task.state.progress,
          message: 'Completed'
        };
      }
    } catch (error) {
      task.state.status = task.controller.signal.aborted ? 'cancelled' : 'failed';
      task.state.error = error instanceof Error ? error.message : 'Unknown task error';
      task.state.progress = {
        ...task.state.progress,
        message: task.state.status === 'cancelled' ? 'Cancelled' : 'Failed'
      };
    } finally {
      this.runningCount -= 1;
      this.drain();
    }
  }
}
