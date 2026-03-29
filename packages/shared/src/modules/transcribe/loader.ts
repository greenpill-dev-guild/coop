/**
 * Thin wrapper around the dynamic import of @huggingface/transformers.
 *
 * This module exists so tests and builds that don't have the dependency
 * installed (e.g. the PWA / app package) can mock it at the module level
 * without Vite's import-analysis plugin failing to resolve the bare specifier.
 *
 * The specifier is built at runtime to prevent Vite's static analysis from
 * attempting to resolve it at build time. This is safe in MV3 extensions
 * (no eval/Function used) and gracefully fails in environments without the dep.
 */

// biome-ignore lint/suspicious/noExplicitAny: transformers.js types vary across versions
export async function loadTransformers(): Promise<{ pipeline: any }> {
  // Build the specifier dynamically so Vite's import analysis doesn't try to resolve it
  const specifier = ['@huggingface', 'transformers'].join('/');
  // biome-ignore lint/suspicious/noExplicitAny: opaque module shape
  const mod: any = await import(/* @vite-ignore */ specifier);
  return { pipeline: mod.pipeline };
}

/**
 * Returns true if `@huggingface/transformers` can be imported in this
 * environment.
 */
export async function canLoadTransformers(
  load: typeof loadTransformers = loadTransformers,
): Promise<boolean> {
  try {
    await load();
    return true;
  } catch {
    return false;
  }
}
