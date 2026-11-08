import solid from "solid-start/vite";
import { defineConfig } from "vite";
import node from "solid-start-node";

// Static single-page build for nsite: no server rendering, the client bundle
// plus index.html in dist/public is the whole deployable.
export default defineConfig({
  plugins: [solid({ ssr: false, adapter: node() })],
});
