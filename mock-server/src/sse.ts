/** One SSE frame. JSON.stringify never emits a raw newline, so one data line is always enough. */
export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
