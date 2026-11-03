import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Sites created from the template have no lockfile. Without a lockfile,
// Vercel runs `pnpm install` with pnpm 6, which fails on Node 22
// (ERR_INVALID_THIS). So starter/vercel.json runs a fixed pnpm through npx.
// That version must be the same as `packageManager` in starter/package.json,
// which GitHub Pages (pnpm/action-setup) uses.
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
    expect(vercel.installCommand).toBe(`npx --yes ${pnpm} install`);
  });

  it("builds with the pnpm in packageManager", () => {
    expect(vercel.buildCommand).toBe(`npx --yes ${pnpm} build`);
  });
});
