import fs from "fs";
import path from "path";

const RETENTION_DAYS = 7;

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

/** Resolve the log directory, with fallback for local dev */
let resolvedLogDir: string | null = null;

function getLogDir(): string {
  if (resolvedLogDir) return resolvedLogDir;

  const candidates = [
    process.env.LOG_DIR,
    "/data/logs",
    path.join(process.cwd(), "logs"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Test that we can actually write
      const testFile = path.join(dir, ".write-test");
      fs.writeFileSync(testFile, "");
      fs.unlinkSync(testFile);
      resolvedLogDir = dir;
      return dir;
    } catch {
      // Try next candidate
    }
  }

  // Last resort — temp directory
  resolvedLogDir = path.join(require("os").tmpdir(), "mynews-logs");
  try {
    fs.mkdirSync(resolvedLogDir, { recursive: true });
  } catch {
    // Nothing we can do
  }
  return resolvedLogDir;
}

/** Get the log file path for a given date (YYYY-MM-DD) */
function logFilePath(date?: string): string {
  const d = date || new Date().toISOString().slice(0, 10);
  return path.join(getLogDir(), `${d}.log`);
}

/** Append a line to today's log file */
function appendLog(level: LogLevel, args: unknown[]): void {
  try {
    const timestamp = new Date().toISOString();
    const raw = args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return `${a.message}${a.stack ? "\n" + a.stack : ""}`;
        return JSON.stringify(a, null, 0);
      })
      .join(" ");
    // Strip ANSI escape codes for clean log files
    const message = raw.replace(/\u001b\[[0-9;]*m/g, "");
    const line = JSON.stringify({ timestamp, level, message }) + "\n";
    fs.appendFileSync(logFilePath(), line);
  } catch {
    // Don't throw from logger
  }
}

/** Prune log files older than RETENTION_DAYS */
export function pruneOldLogs(): void {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const files = fs.readdirSync(getLogDir());
    for (const file of files) {
      if (!file.endsWith(".log")) continue;
      const dateStr = file.replace(".log", "");
      const fileDate = new Date(dateStr + "T00:00:00Z");
      if (isNaN(fileDate.getTime())) continue;
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(getLogDir(), file));
      }
    }
  } catch {
    // Don't throw from pruner
  }
}

/** List available log files, newest first */
export function listLogFiles(): { date: string; sizeKb: number }[] {
  try {
    const files = fs.readdirSync(getLogDir());
    return files
      .filter((f) => f.endsWith(".log"))
      .map((f) => {
        const stat = fs.statSync(path.join(getLogDir(), f));
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
 * Install console interceptors to capture all log output to files.
 * Call once at startup (e.g., in instrumentation.ts).
 */
export function installLogInterceptors(): void {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    originalLog.apply(console, args);
    appendLog("info", args);
  };

  console.warn = (...args: unknown[]) => {
    originalWarn.apply(console, args);
    appendLog("warn", args);
  };

  console.error = (...args: unknown[]) => {
    originalError.apply(console, args);
    appendLog("error", args);
  };

  // Prune old logs on startup
  pruneOldLogs();
}
