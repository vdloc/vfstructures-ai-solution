import { createMockServer } from "./server.ts";

const port = Number(process.env.PORT ?? 8787);
const delayScale = Number(process.env.MOCK_DELAY_SCALE ?? 1);
if (!Number.isFinite(delayScale) || delayScale < 0) throw new Error("MOCK_DELAY_SCALE must be a number >= 0");

createMockServer({ delayScale }).listen(port, () => {
  console.log(`Assistant.Api mock listening on http://localhost:${port} (delay scale ${delayScale})`);
});
