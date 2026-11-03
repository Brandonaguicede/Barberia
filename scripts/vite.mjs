import { build, createServer, preview } from "vite";
import config from "../vite.config.ts";
// Load our typed config with Node 24 instead of spawning esbuild to bundle it.
const options = { ...config, configFile: false };
const mode = process.argv[2] || "dev";
if (mode === "build") await build(options);
else if (mode === "preview") {
  const server = await preview(options);
  server.printUrls();
} else {
  const server = await createServer(options);
  await server.listen();
  server.printUrls();
}
