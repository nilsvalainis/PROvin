/**
 * Ļauj tsx CLI importēt lib/* failus ar `import "server-only"`.
 * Lietošana: npx tsx --import ./scripts/stub-server-only.mjs …
 */
import Module from "node:module";

const orig = Module.prototype.require;
Module.prototype.require = function (id, ...rest) {
  if (id === "server-only") return {};
  return orig.call(this, id, ...rest);
};
