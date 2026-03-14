import fs from "fs";
import path from "path";

const LOG_DIR = process.env.LOG_DIR || "/data/logs";
const RETENTION_DAYS = 7;

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

/** Ensure log directory exists */
function ensureDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch {
    // Can't create dir — logging will silently fail
  }
}

/** Get the log file path for a given date (YYYY-MM-DD) */
function logFilePath(date?: string): string {
  const d = date || new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${d}.log`);
}

/** Append a line to today's log file */
function appendLog(level: LogLevel, args: unknown[]): void {
  try {
    ensureDir();
    const timestamp = new Date().toISOString();
    const message = args
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 0)))
      .join(" ");
    const line = JSON.stringify({ timestamp, level, message }) + "\n";
    fs.appendFileSync(logFilePath(), line);
  } catch {
    // Don't throw from logger
  }
}

/** Prune log files older than RETENTION_DAYS */
export function pruneOldLogs(): void {
  try {
    ensureDir();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const files = fs.readdirSync(LOG_DIR);
    for (const file of files) {
      if (!file.endsWith(".log")) continue;
      const dateStr = file.replace(".log", "");
      const fileDate = new Date(dateStr + "T00:00:00Z");
      if (isNaN(fileDate.getTime())) continue;
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file));
      }
    }
  } catch {
    // Don't throw from pruner
  }
}

/** List available log files, newest first */
export function listLogFiles(): { date: string; sizeKb: number }[] {
  try {
    ensureDir();
    const files = fs.readdirSync(LOG_DIR);
    return files
      .filter((f) => f.endsWith(".log"))
      .map((f) => {
        const stat = fs.statSync(path.join(LOG_DIR, f));
        return { date: f.replace(".log", ""), sizeKb: Math.round(stat.size / 1024) };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

/** Read log entries from a specific date, with optional level filter */
export function readLogEntries(
  date: string,
  level?: LogLevel,
  limit = 500,
): LogEntry[] {
  try {
    const filePath = logFilePath(date);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const entries: LogEntry[] = [];
    // Read from end (newest first)
    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      try {
        const entry = JSON.parse(lines[i]) as LogEntry;
        if (level && entry.level !== level) continue;
        entries.push(entry);
      } catch {
        // Skip malformed lines
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/** Read raw log file content for download */
export function readLogFileRaw(date: string): string | null {
  try {
    const filePath = logFilePath(date);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Install console interceptors to capture warn/error to log files.
 * Call once at startup (e.g., in instrumentation.ts).
 */
export function installLogInterceptors(): void {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  console.warn = (...args: unknown[]) => {
    originalWarn.apply(console, args);
    appendLog("warn", args);
  };

  console.error = (...args: unknown[]) => {
    originalError.apply(console, args);
    appendLog("error", args);
  };

  // Capture [tagged] log messages (e.g., [feeds], [background-refresh])
  console.log = (...args: unknown[]) => {
    originalLog.apply(console, args);
    if (args.length > 0 && typeof args[0] === "string" && args[0].startsWith("[")) {
      appendLog("info", args);
    }
  };

  // Prune old logs on startup
  pruneOldLogs();
}
