import { app, BrowserWindow } from "electron";
import { spawn } from "child_process";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import fs from "fs";
import log from "electron-log";

let mainWindow;
let backendProcess;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Always log to file
log.transports.file.resolvePath = () =>
  path.join(app.getPath("userData"), "main.log");

log.info("[ELECTRON] Logger initialized");
log.info("[ELECTRON] UserData path:", app.getPath("userData"));

// Catch crashes
process.on("uncaughtException", (error) => {
  log.error("[UNCAUGHT EXCEPTION]", error);
});

process.on("unhandledRejection", (reason) => {
  log.error("[UNHANDLED REJECTION]", reason);
});

app.commandLine.appendSwitch("enable-logging");
app.commandLine.appendSwitch("v", "1");

/**
 * Find Python executable
 */
function findPythonExecutable() {
  // Try environment variable first
  if (process.env.PYTHON_EXECUTABLE) {
    if (fs.existsSync(process.env.PYTHON_EXECUTABLE)) {
      return process.env.PYTHON_EXECUTABLE;
    }
  }

  // Common Python paths on macOS/Linux
  const pythonCandidates = [
    "/usr/local/bin/python3",
    "/opt/homebrew/bin/python3",
    "/usr/bin/python3",
    "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3",
    "/Library/Frameworks/Python.framework/Versions/3.10/bin/python3",
    "/Library/Frameworks/Python.framework/Versions/3.9/bin/python3",
  ];

  for (const candidate of pythonCandidates) {
    if (fs.existsSync(candidate)) {
      log.info("[BACKEND] Found Python at:", candidate);
      return candidate;
    }
  }

  // Try 'which' command
  try {
    const pythonPath = execSync("which python3", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (pythonPath) {
      log.info("[BACKEND] Found Python via which:", pythonPath);
      return pythonPath;
    }
  } catch (e) {
    log.error("[BACKEND] which python3 failed:", e.message);
  }

  log.error("[BACKEND] ❌ Python3 NOT FOUND in any standard location");
  return null;
}

/**
 * Wait for backend
 */
function waitForBackend(url, callback) {
  const check = () => {
    http
      .get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          callback();
        } else {
          setTimeout(check, 500);
        }
      })
      .on("error", () => setTimeout(check, 500));
  };
  check();
}

/**
 * Start backend (DEV + PROD safe)
 */
function startBackend() {
  const isDev = !app.isPackaged;

  const backendDir = isDev
    ? path.join(__dirname, "..", "backend")
    : path.join(process.resourcesPath, "app.asar.unpacked", "backend");

  log.info("[BACKEND] Directory:", backendDir);

  if (!fs.existsSync(backendDir)) {
    log.error("[BACKEND] ❌ Backend directory NOT FOUND:", backendDir);
    try {
      log.error(
        "[BACKEND] resourcesPath contents:",
        fs.readdirSync(process.resourcesPath)
      );
      log.error(
        "[BACKEND] resourcesPath app.asar.unpacked contents:",
        fs.existsSync(path.join(process.resourcesPath, "app.asar.unpacked"))
          ? fs.readdirSync(path.join(process.resourcesPath, "app.asar.unpacked"))
          : []
      );
    } catch (e) {
      log.error("[BACKEND] Failed to read resourcesPath", e);
    }
    return;
  }

  // ✅ Verify main.py exists
  const mainPy = path.join(backendDir, "main.py");
  if (!fs.existsSync(mainPy)) {
    log.error("[BACKEND] ❌ main.py NOT FOUND in backend directory:", mainPy);
    return;
  }

  // ✅ Find Python executable
  const pythonExecutable = findPythonExecutable();
  if (!pythonExecutable) {
    log.error(
      "[BACKEND] ❌ Cannot start backend: Python3 executable not found"
    );
    return;
  }

  const command = pythonExecutable;
  const args = [
    "-m",
    "uvicorn",
    "main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "5000",
  ];

  // In production, if the PyInstaller executable exists, use it instead
  const exePath = path.join(backendDir, "main");
  if (!isDev && fs.existsSync(exePath)) {
    log.info("[BACKEND] Using PyInstaller executable:", exePath);
    backendProcess = spawn(exePath, [], {
      cwd: backendDir,
      shell: false,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PATH: process.env.PATH,
      },
    });
  } else {
    log.info("[BACKEND] Starting with:", command, args);
    log.info("[BACKEND] Working directory:", backendDir);
    log.info("[BACKEND] Environment PYTHONUNBUFFERED: 1");

    try {
      backendProcess = spawn(command, args, {
        cwd: backendDir,
        shell: false,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PATH: process.env.PATH,
        },
      });
    } catch (e) {
      log.error("[BACKEND] ❌ Error spawning backend:", e.message);
      return;
    }
  }

  backendProcess.stdout.on("data", (data) => {
    const message = data.toString().trim();
    log.info("[BACKEND STDOUT]", message);
    console.log("[BACKEND STDOUT]", message); // Also log to console for debugging
  });

  backendProcess.stderr.on("data", (data) => {
    const message = data.toString().trim();
    log.error("[BACKEND STDERR]", message);
    console.error("[BACKEND STDERR]", message); // Also log to console
  });

  backendProcess.on("error", (err) => {
    log.error("[BACKEND SPAWN ERROR]", err.message);
    console.error("[BACKEND SPAWN ERROR]", err.message);
  });

  backendProcess.on("close", (code, signal) => {
    log.error("[BACKEND EXITED] code:", code, "signal:", signal);
    console.error("[BACKEND EXITED] code:", code, "signal:", signal);
  });
}

/**
 * Create window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // 🔥 Allow file:// to access localhost
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      log.info(`[RENDERER] ${message} (${sourceId}:${line})`);
    }
  );

  mainWindow.webContents.on("did-fail-load", (e, code, desc, url) => {
    log.error("[ELECTRON] Load failed:", code, desc, url);
  });

  mainWindow.webContents.on("render-process-gone", (e, details) => {
    log.error("[ELECTRON] Renderer crashed:", details);
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    log.info("[ELECTRON] Loading DEV server");
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const indexPath = path.join(
      process.resourcesPath,
      "app.asar",
      "dist",
      "index.html"
    );
    const fallbackIndexPath = path.join(
      process.resourcesPath,
      "dist",
      "index.html"
    );

    log.info("[ELECTRON] Loading:", indexPath);

    const finalIndexPath = fs.existsSync(indexPath)
      ? indexPath
      : fs.existsSync(fallbackIndexPath)
      ? fallbackIndexPath
      : null;

    if (!finalIndexPath) {
      log.error("[ELECTRON] ❌ index.html NOT FOUND", {
        indexPath,
        fallbackIndexPath,
      });
      mainWindow.loadURL(
        "data:text/html,<h1>UI not found</h1><p>Check logs</p>"
      );
      return;
    }

    mainWindow.loadFile(finalIndexPath);
  }

  mainWindow.webContents.once("did-finish-load", () => {
    // DevTools disabled for production
    // mainWindow.webContents.openDevTools({ mode: "detach" });
  });
}

/**
 * Lifecycle
 */
app.whenReady().then(() => {
  log.info("[ELECTRON] App ready");

  startBackend();

  waitForBackend("http://127.0.0.1:5000", () => {
    log.info("[ELECTRON] Backend is ready");
    createWindow();
  });
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== "darwin") app.quit();
});