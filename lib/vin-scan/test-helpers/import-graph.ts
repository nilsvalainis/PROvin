/**
 * Testu palīgs: īsts moduļu importu grafs (TypeScript kompilatora `preProcessFile` + `resolveModuleName`
 * ar projekta tsconfig ceļiem), nevis teksta meklēšana failā. Seko arī netiešiem importiem.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

let cached: { options: ts.CompilerOptions; host: ts.CompilerHost; cache: ts.ModuleResolutionCache } | null = null;

/** tsconfig (ceļi `@/…`) nolasa vienreiz; failu sarakstu neskenē. */
function project() {
  if (cached) return cached;
  const cfg = ts.readConfigFile(path.join(ROOT, "tsconfig.json"), ts.sys.readFile);
  const options = ts.convertCompilerOptionsFromJson(cfg.config.compilerOptions ?? {}, ROOT).options;
  const host = ts.createCompilerHost(options, true);
  const cache = ts.createModuleResolutionCache(ROOT, (f) => f, options);
  cached = { options, host, cache };
  return cached;
}

function resolveImport(spec: string, fromFile: string): ts.ResolvedModuleFull | undefined {
  const { options, host, cache } = project();
  return ts.resolveModuleName(spec, fromFile, options, host, cache).resolvedModule;
}

/** Visi projekta faili (relatīvi pret sakni), ko dotie ieejas faili importē tieši vai netieši. */
export function reachableProjectFiles(entries: readonly string[]): Map<string, string> {
  /** fails -> no kura faila tas pirmo reizi sasniegts (kļūdas ziņojumam). */
  const seen = new Map<string, string>();
  const queue: [string, string][] = entries.map((rel) => [path.join(ROOT, rel), "(ieeja)"]);
  while (queue.length) {
    const [file, from] = queue.pop()!;
    const rel = path.relative(ROOT, file);
    if (seen.has(rel)) continue;
    if (!existsSync(file)) throw new Error(`import-graph: nav faila ${rel}`);
    seen.set(rel, from);
    const info = ts.preProcessFile(readFileSync(file, "utf8"), true, true);
    for (const imp of info.importedFiles) {
      const resolved = resolveImport(imp.fileName, file);
      if (!resolved || resolved.isExternalLibraryImport) continue;
      const target = resolved.resolvedFileName;
      if (target.includes("/node_modules/") || !/\.(tsx?|mts|cts)$/.test(target) || target.endsWith(".d.ts")) continue;
      queue.push([target, rel]);
    }
  }
  return seen;
}

/**
 * Ārējie importi (node: moduļi, npm pakotnes, `server-only`), ko sasniedz no ieejas failiem:
 * specifikators -> projekta fails, kas to importē.
 */
export function reachableExternalImports(entries: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of reachableProjectFiles(entries).keys()) {
    const file = path.join(ROOT, rel);
    for (const imp of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      const resolved = resolveImport(imp.fileName, file);
      const external = !resolved || resolved.isExternalLibraryImport || resolved.resolvedFileName.includes("/node_modules/");
      if (external && !/\.(css|svg|png|jpe?g|webp)$/.test(imp.fileName) && !out.has(imp.fileName)) out.set(imp.fileName, rel);
    }
  }
  return out;
}

/** Importu ķēde no ieejas līdz failam (diagnostikai, ja aizliegts fails ir sasniedzams). */
export function importChain(reached: Map<string, string>, rel: string): string[] {
  const chain = [rel];
  let cur = reached.get(rel);
  while (cur && cur !== "(ieeja)" && chain.length < 50) {
    chain.unshift(cur);
    cur = reached.get(cur);
  }
  return chain;
}

/**
 * Kādus vārdus fails ņem no dotā projekta moduļa (import / re-export). "*" nozīmē visu moduli
 * (namespace imports, `export *`, dinamisks `import()` vai `require`).
 */
export function importedBindings(fileRel: string, moduleRel: string): string[] {
  const file = path.join(ROOT, fileRel);
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const target = path.join(ROOT, moduleRel);
  const pointsAtTarget = (spec: ts.Expression | undefined) =>
    Boolean(spec && ts.isStringLiteralLike(spec) && resolveImport(spec.text, file)?.resolvedFileName === target);
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && pointsAtTarget(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (!clause) names.push("*");
      if (clause?.name) names.push("default");
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) names.push("*");
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) names.push((el.propertyName ?? el.name).text);
      }
    } else if (ts.isExportDeclaration(node) && pointsAtTarget(node.moduleSpecifier)) {
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) names.push("*");
      else for (const el of node.exportClause.elements) names.push((el.propertyName ?? el.name).text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      pointsAtTarget(node.arguments[0])
    ) {
      names.push("*");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}
