import { Command } from "commander";
import { getExtensionClient } from "../extension-client.js";

interface EventLog {
  type: string;
  domain: string;
  timestamp: number;
  data?: unknown;
}

export const eventsCommand = new Command("events").description(
  "Event log operations"
);

eventsCommand
  .command("list")
  .description("List recent events")
  .option("-n, --limit <number>", "Number of events to show", "20")
  .option("-t, --type <type>", "Filter by event type")
  .option("-p, --pretty", "Pretty print JSON output")
  .action(async (options) => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_EVENTS_LIST", {
        limit: parseInt(options.limit, 10),
        type: options.type,
      });

      if (response.success) {
        const events = response.data as EventLog[];

        if (events.length === 0) {
          console.log("(no events)");
        } else if (options.pretty) {
          console.log(JSON.stringify(events, null, 2));
        } else {
          for (const event of events) {
            const time = new Date(event.timestamp).toISOString();
            console.log(`[${time}] ${event.type} @ ${event.domain}`);
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

eventsCommand
  .command("count")
  .description("Get total event count")
  .action(async () => {
    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_EVENTS_COUNT");

      if (response.success) {
        console.log(response.data);
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

eventsCommand
  .command("clear")
  .description("Clear all events")
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    if (!options.yes) {
      console.log("Use --yes to confirm clearing all events");
      process.exit(1);
    }

    try {
      const client = await getExtensionClient();
      const response = await client.send("DEBUG_EVENTS_CLEAR");

      if (response.success) {
        console.log("Events cleared");
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
