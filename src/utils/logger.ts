import chalk from 'chalk';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  verbose(message: string, ...args: any[]): void;
  setVerbose?(enabled: boolean): void;
}

class ConsoleLogger implements Logger {
  constructor(private verboseEnabled = false) {}

  setVerbose(enabled: boolean): void {
    this.verboseEnabled = enabled;
  }

  debug(message: string, ...args: any[]): void {
    if (this.verboseEnabled) {
      console.debug(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.info(chalk.blue(`[INFO] ${message}`), ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(chalk.yellow(`[WARN] ${message}`), ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(chalk.red(`[ERROR] ${message}`), ...args);
  }

  verbose(message: string, ...args: any[]): void {
    if (this.verboseEnabled) {
      console.log(chalk.gray(`[VERBOSE] ${message}`), ...args);
    }
  }
}

let globalLogger: Logger;

export function setupLogger(verbose = false): Logger {
  if (!globalLogger) {
    globalLogger = new ConsoleLogger(verbose);
  } else if (globalLogger instanceof ConsoleLogger) {
    (globalLogger as any).setVerbose(verbose);
  }
  return globalLogger;
}

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new ConsoleLogger();
  }
  return globalLogger;
}