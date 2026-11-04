import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Sites created from the template have no lockfile. Without a lockfile,
// Vercel runs `pnpm install` with pnpm 6, which fails on Node 22
// (ERR_INVALID_THIS). So starter/vercel.json runs a fixed pnpm through npx.
// That version must be the same as `packageManager` in starter/package.json,
// which GitHub Pages (pnpm/action-setup) uses.
//
// Vercel also restores node_modules from the build cache. Without a lockfile,
// `pnpm install` keeps the versions that are in node_modules if they are in
// the range, so a new release of the framework does not take effect.
// `pnpm update` installs the newest versions in the range, as a fresh install
// does. `--no-save` keeps the ranges in package.json. If the site has a
// lockfile, the install command keeps `pnpm install`, so that the lockfile
// controls the versions.
const starter = resolve(__dirname, "../starter");
const readJson = (name: string) =>
  JSON.parse(readFileSync(resolve(starter, name), "utf-8"));

describe("starter/vercel.json", () => {
  const pnpm = (readJson("package.json").packageManager as string).split("+")[0];
  const vercel = readJson("vercel.json");

  it("packageManager is pnpm@<version>", () => {
    expect(pnpm).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
  });

  it("installs with the pnpm in packageManager", () => {
    expect(vercel.installCommand).toBe(
      `if [ -f pnpm-lock.yaml ]; then npx --yes ${pnpm} install; else npx --yes ${pnpm} update --no-save; fi`
    );
  });

  it("install command is short enough for Vercel (256 characters)", () => {
    expect(vercel.installCommand.length).toBeLessThanOrEqual(256);
  });

  it("builds with the pnpm in packageManager", () => {
    expect(vercel.buildCommand).toBe(`npx --yes ${pnpm} build`);
  });
});
