import type { Repositories } from '@main/db';
import type { SourceScanner } from '@main/scanner/sourceScanner';
import type { TaskQueue } from '@main/tasks/taskQueue';

export interface IpcContext {
  repositories: Repositories;
  scanner: SourceScanner;
  scanQueue: TaskQueue;
}
