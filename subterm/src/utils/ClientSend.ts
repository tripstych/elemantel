import { Client } from "@colyseus/core";

/**
 * Lightweight helper to send typed messages to a specific client.
 * Wraps Colyseus Client.send and centralizes logging/error handling.
 */
export function send(client: Client, type: string, payload?: any): void {
  try {
    client.send(type, payload ?? {});
  } catch (err) {
    console.warn(`[ClientSend] Failed to send '${type}':`, err);
  }
}

/**
 * Convenience helpers for common message types.
 */
export const ClientMessages = {
  error(client: Client, message: string) {
    send(client, "error", { message });
  },
  info(client: Client, message: string) {
    send(client, "info", { message });
  },
  log(client: Client, message: string) {
    send(client, "log", { message });
  },
};
