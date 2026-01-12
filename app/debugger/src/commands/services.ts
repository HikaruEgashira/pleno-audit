import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";
import type { DetectedService } from "@pleno-audit/detectors";

export const servicesCommand = new Command("services").description(
  "Detected services operations"
);

servicesCommand
  .command("list")
  .description("List detected services")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_SERVICES_LIST");

      if (response.success) {
        const services = response.data as Record<string, DetectedService>;
        const serviceList = Object.values(services);

        if (serviceList.length === 0) {
          console.log("(no services detected)");
        } else if (options.pretty) {
          console.log(JSON.stringify(services, null, 2));
        } else {
          for (const service of serviceList) {
            console.log(`[${service.domain}]`);
            console.log(
              `  Detected: ${new Date(service.detectedAt).toISOString()}`
            );
            console.log(`  Login: ${service.hasLoginPage}`);
            console.log(`  Privacy: ${service.privacyPolicyUrl || "(none)"}`);
            console.log(`  ToS: ${service.termsOfServiceUrl || "(none)"}`);
            console.log(`  Cookies: ${service.cookies.length}`);
          }
        }
      } else {
        console.error(`Error: ${response.error}`);
        process.exit(1);
      }

      client.disconnect();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

servicesCommand
  .command("get <domain>")
  .description("Get service by domain")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (domain: string, options) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_SERVICES_GET", { domain });

      if (response.success) {
        if (response.data === null) {
          console.log(`Service not found: ${domain}`);
          process.exit(1);
        }

        const output = options.pretty
          ? JSON.stringify(response.data, null, 2)
          : JSON.stringify(response.data);
        console.log(output);
      } else {
        console.error(`Error: ${response.error}`);
        process.exit(1);
      }

      client.disconnect();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });

servicesCommand
  .command("clear")
  .description("Clear all detected services")
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    if (!options.yes) {
      console.log("Use --yes to confirm clearing all services");
      process.exit(1);
    }

    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_SERVICES_CLEAR");

      if (response.success) {
        console.log("Services cleared");
      } else {
        console.error(`Error: ${response.error}`);
        process.exit(1);
      }

      client.disconnect();
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  });
