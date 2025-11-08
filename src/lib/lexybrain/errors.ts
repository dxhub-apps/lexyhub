// lib/lexybrain/errors.ts
// Error classes for LexyBrain RunPod client

export class RunPodClientError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "RunPodClientError";
  }
}

export class RunPodTimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message);
    this.name = "RunPodTimeoutError";
  }
}
