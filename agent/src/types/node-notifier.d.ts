declare module "node-notifier" {
  interface NotifyOptions {
    title?: string;
    message?: string;
    wait?: boolean;
    sound?: boolean;
  }

  type NotifyCallback = (err: Error | null, response?: unknown, metadata?: unknown) => void;

  export default {
    notify(options: NotifyOptions, callback?: NotifyCallback): void;
  };
}