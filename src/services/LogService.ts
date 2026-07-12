type LogLevel = 'info' | 'warn' | 'error';

class LogService {
  private formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  public info(message: string, context?: any): void {
    const formatted = this.formatMessage('info', message, context);
    console.log(formatted);
  }

  public warn(message: string, context?: any): void {
    const formatted = this.formatMessage('warn', message, context);
    console.warn(formatted);
  }

  public error(message: string, error?: any, context?: any): void {
    const errContext = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack, ...context } : { error, ...context };
    const formatted = this.formatMessage('error', message, errContext);
    console.error(formatted);
  }
}

export const logger = new LogService();
export default LogService;
