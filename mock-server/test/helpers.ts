import type { AddressInfo } from "node:net";
import { createMockServer, type MockServerOptions } from "../src/server.ts";
import { MockState } from "../src/store.ts";

export interface TestServer {
  base: string;
  state: MockState;
  close: () => Promise<void>;
}

export async function startServer(options: Partial<MockServerOptions> = {}): Promise<TestServer> {
  const state = options.state ?? new MockState();
  const server = createMockServer({ delayScale: 0, ...options, state });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    state,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export const authHeaders = (user = "dev-user"): Record<string, string> => ({
  authorization: `Bearer ${user}`,
  "content-type": "application/json",
});
