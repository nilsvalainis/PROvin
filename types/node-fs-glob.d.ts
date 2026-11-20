import "node:fs";

/** Node 22+ `fs.globSync` (CI darbina Node 24), bet `@types/node` ^20 to vēl neapraksta. */
declare module "node:fs" {
  export function globSync(
    pattern: string | readonly string[],
    options?: { cwd?: string; exclude?: (fileName: string) => boolean },
  ): string[];
}
