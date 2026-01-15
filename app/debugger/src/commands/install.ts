import { Command } from "commander";

export const installCommand = new Command("server")
  .description("Start the debug server")
  .option("-p, --port <port>", "Port to listen on", "9222")
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    console.log(`Starting debug server on port ${port}...`);
    console.log("Waiting for extension to connect...");
    console.log("Run the extension in dev mode: pnpm --filter @pleno-audit/extension dev");
    console.log("\nPress Ctrl+C to stop\n");

    // Dynamic import to avoid starting server on CLI load
    const { getDebugServer, killPortProcess } = await import("../server.js");

    // Kill existing process if port is in use
    await killPortProcess(port);

    const server = getDebugServer();

    server.on("extension-connected", () => {
      console.log("Extension connected! Ready for commands.");
    });

    server.on("extension-disconnected", () => {
      console.log("Extension disconnected. Waiting for reconnection...");
    });

    // Keep process alive
    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      server.close();
      process.exit(0);
    });

    await new Promise(() => {}); // Keep alive
  });
