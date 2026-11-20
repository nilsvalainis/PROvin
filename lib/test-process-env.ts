/**
 * Testiem: izveido `NodeJS.ProcessEnv` no daļēja objekta.
 * Next tipi prasa `NODE_ENV`, bet testi apzināti padod tikai vajadzīgos mainīgos.
 */
export function testEnv(vars: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return vars as unknown as NodeJS.ProcessEnv;
}
