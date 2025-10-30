const { spawn } = require("child_process");
const path = require("path");
const logger = require("../utils/logger.js");

class DashboardService {
  constructor() {
    this.process = null;
    this.isStarting = false;
    this.dashboardDir = path.join(process.cwd(), "dashboard");
    this.enabled =
      (process.env.LUNA_DASHBOARD_ENABLED || "true").toLowerCase() !== "false";
  }

  start() {
    if (!this.enabled) {
      logger.info("DASHBOARD", "Dashboard service disabled via environment.");
      return;
    }

    if (this.process || this.isStarting) {
      return;
    }

    this.isStarting = true;

    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const script =
      process.env.LUNA_DASHBOARD_SCRIPT ||
      (process.env.NODE_ENV === "production" ? "start" : "dev");

    logger.info(
      "DASHBOARD",
      `Bootstrapping dashboard with \`${script}\` script (cwd: ${this.dashboardDir})`
    );

    try {
      this.process = spawn(npmCommand, ["run", script], {
        cwd: this.dashboardDir,
        env: {
          ...process.env,
          // Ensure Next.js telemetry is disabled in production environments.
          NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1"
        },
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      this.isStarting = false;
      logger.error("DASHBOARD", "Failed to spawn dashboard process:", error);
      return;
    }

    this.process.stdout.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        logger.info("DASHBOARD", message);
      }
    });

    this.process.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        logger.error("DASHBOARD", message);
      }
    });

    this.process.on("exit", (code, signal) => {
      logger.warn(
        "DASHBOARD",
        `Dashboard process exited (code: ${code ?? "N/A"}, signal: ${signal ?? "N/A"})`
      );
      this.process = null;
      this.isStarting = false;
    });

    this.process.on("error", (error) => {
      logger.error("DASHBOARD", "Dashboard process error:", error);
      this.process = null;
      this.isStarting = false;
    });

    this.isStarting = false;
  }

  stop() {
    if (!this.process) {
      return;
    }

    logger.info("DASHBOARD", "Stopping dashboard process...");
    this.process.kill();
    this.process = null;
  }
}

const dashboardService = new DashboardService();

process.on("exit", () => dashboardService.stop());
process.on("SIGINT", () => {
  dashboardService.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  dashboardService.stop();
  process.exit(0);
});

module.exports = dashboardService;
