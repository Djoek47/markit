import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const upstreamUrl = "https://github.com/Augani/openreel-video.git";
const vendorDir = path.join(rootDir, "vendor", "openreel");
const cacheDir = path.join(rootDir, ".tmp", "openreel-video");
const preservedVendorFiles = [
  "core/wasm/beat-detection/build/beat.wasm",
  "core/wasm/fft/build/fft.wasm",
  "core/wasm/wav/build/wav.wasm",
];

type Args = {
  source?: string;
  ref: string;
  force: boolean;
  noInstall: boolean;
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  assertCommand("git", ["--version"]);

  if (!args.force) {
    assertCleanSyncTargets();
  }

  const sourceDir = args.source ? path.resolve(args.source) : await prepareUpstreamCheckout(args.ref);
  assertOpenReelCheckout(sourceDir);

  const upstreamCommit = git(["rev-parse", "HEAD"], sourceDir).trim();
  const upstreamBranch = git(["branch", "--show-current"], sourceDir).trim() || args.ref;

  await refreshVendor(sourceDir);
  await applyMarkitCompatibilityPatches();
  await writeManifest({
    upstreamUrl,
    upstreamRef: args.ref,
    upstreamBranch,
    upstreamCommit,
    syncedAt: new Date().toISOString(),
  });

  if (!args.noInstall) {
    console.log("Installing Markit dependencies after sync...");
    run("npm", ["install"], rootDir);
  }

  console.log(`OpenReel vendor sync complete at ${upstreamCommit}.`);
  console.log("Next steps: npm run lint && npm test && npm run build");
}

function parseArgs(raw: string[]): Args {
  const parsed: Args = {
    ref: "main",
    force: false,
    noInstall: false,
  };

  for (let index = 0; index < raw.length; index += 1) {
    const arg = raw[index];
    if (arg === "--source") {
      parsed.source = raw[++index];
    } else if (arg === "--ref") {
      parsed.ref = raw[++index] ?? "main";
    } else if (arg === "--force") {
      parsed.force = true;
    } else if (arg === "--no-install") {
      parsed.noInstall = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  npm run openreel:sync
  npm run openreel:sync -- --ref main
  npm run openreel:sync -- --source "C:/path/to/openreel-video" --no-install

Options:
  --source       Use an existing OpenReel checkout instead of cloning/fetching.
  --ref          Upstream branch, tag, or commit to sync. Defaults to main.
  --force        Allow sync when Markit's OpenReel-owned files are dirty.
  --no-install   Skip npm install after copying source.
`);
}

function assertCommand(command: string, commandArgs: string[]) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Required command failed or is missing: ${command}`);
  }
}

function assertCleanSyncTargets() {
  const result = spawnSync(
    "git",
    [
      "status",
      "--porcelain",
      "--",
      "vendor/openreel",
      "components/openreel",
      "app/editor/page.tsx",
      "app/globals.css",
      "next.config.ts",
      "tsconfig.json",
      "eslint.config.mjs",
      "vitest.config.ts",
      "package.json",
      "package-lock.json",
      "docs/openreel-sync.md",
      "scripts/sync-openreel.ts",
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || "Unable to check git status.");
  }

  if (result.stdout.trim()) {
    throw new Error(
      `OpenReel sync-owned files have uncommitted changes:\n${result.stdout}\nCommit them or rerun with --force.`,
    );
  }
}

async function prepareUpstreamCheckout(ref: string): Promise<string> {
  mkdirSync(path.dirname(cacheDir), { recursive: true });

  if (!existsSync(path.join(cacheDir, ".git"))) {
    console.log(`Cloning ${upstreamUrl} into ${path.relative(rootDir, cacheDir)}...`);
    run("git", ["clone", upstreamUrl, cacheDir], rootDir);
  }

  console.log(`Fetching OpenReel ${ref}...`);
  run("git", ["fetch", "--tags", "origin"], cacheDir);
  run("git", ["checkout", ref], cacheDir);
  run("git", ["pull", "--ff-only"], cacheDir, { allowFailure: true });
  return cacheDir;
}

function assertOpenReelCheckout(sourceDir: string) {
  const requiredPaths = [
    "apps/web/src",
    "packages/core/src",
    "packages/ui/src",
    "packages/image-core/src",
  ];

  for (const relativePath of requiredPaths) {
    if (!existsSync(path.join(sourceDir, relativePath))) {
      throw new Error(`Not an OpenReel checkout: missing ${relativePath}`);
    }
  }
}

async function refreshVendor(sourceDir: string) {
  const copyMap = [
    ["apps/web/src", "web"],
    ["packages/core/src", "core"],
    ["packages/ui/src", "ui"],
    ["packages/image-core/src", "image-core"],
  ] as const;

  mkdirSync(vendorDir, { recursive: true });
  const preservedFiles = preserveVendorFiles();

  for (const [from, to] of copyMap) {
    const destination = path.join(vendorDir, to);
    rmSync(destination, { recursive: true, force: true });
    await cp(path.join(sourceDir, from), destination, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
    });
  }

  restoreVendorFiles(preservedFiles);
}

async function applyMarkitCompatibilityPatches() {
  await replaceInFile(
    "web/config/api-endpoints.ts",
    /import\.meta\.env\.DEV/g,
    'process.env.NODE_ENV !== "production"',
  );

  await replaceInFile(
    "web/services/api-proxy.ts",
    /import\.meta\.env\.DEV/g,
    'process.env.NODE_ENV !== "production"',
  );

  await replaceInFile(
    "web/services/service-worker.ts",
    /if \((?:!import\.meta\.env\.DEV && import\.meta\.env\.VITE_ENABLE_SW !== "true"|import\.meta\.env\.DEV && !import\.meta\.env\.VITE_ENABLE_SW)\) \{/g,
    'if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_OPENREEL_ENABLE_SW !== "true") {',
  );

  await replaceInFile(
    "core/video/decode-worker.ts",
    /  \} catch \{\r?\n    try \{\r?\n      mediabunnyModule = \(await import\(\r?\n        "https:\/\/esm\.sh\/mediabunny@[^"]+" as string\r?\n      \)\) as typeof import\("mediabunny"\);\r?\n      return mediabunnyModule;\r?\n    \} catch \{\r?\n      return null;\r?\n    \}\r?\n  \}/g,
    "  } catch {\n    return null;\n  }",
  );

  await replaceInFile(
    "core/video/decode-worker.ts",
    / \} catch \(error\) \{\r?\n try \{\r?\n mediabunnyModule = await import\("(?:https:\/\/esm\.sh\/mediabunny@[^"]+|mediabunny)"\);\r?\n mediabunnyAvailable = true;\r?\n return mediabunnyModule;\r?\n \} catch \(cdnError\) \{\r?\n mediabunnyAvailable = false;\r?\n return null;\r?\n \}\r?\n \}/g,
    " } catch (error) {\n mediabunnyAvailable = false;\n return null;\n }",
  );

  await replaceInFile(
    "web/components/editor/timeline/TrackLane.tsx",
    /timelineRef: React\.RefObject<HTMLDivElement>;/g,
    "timelineRef: React.RefObject<HTMLDivElement | null>;",
  );

  await replaceInFile(
    "web/components/editor/timeline/ClipComponent.tsx",
    /timelineRef: React\.RefObject<HTMLDivElement>;/g,
    "timelineRef: React.RefObject<HTMLDivElement | null>;",
  );

  await replaceInFile(
    "web/components/editor/Toolbar.tsx",
    />\s*Open Reel\s*<\/span>/g,
    ">\n                Markit\n              </span>",
  );

  await replaceInFile(
    "web/components/editor/tour/tour-steps.ts",
    /title: "Welcome to OpenReel"/g,
    'title: "Welcome to Markit"',
  );

  await replaceInFile(
    "web/components/MobileBlocker.tsx",
    /OpenReel is a professional video editor/g,
    "Markit is a professional video editor",
  );
  await replaceInFile("web/components/MobileBlocker.tsx", />\s*OpenReel\s*</g, ">\n            Markit\n          <");

  await writeProjectNames();

  await replaceInFile(
    "web/components/editor/Preview.tsx",
    /const emptyText = isDark \? "#52525b" : "#a1a1aa";/g,
    'const emptyText = isDark ? "#9f9ca6" : "#6f6878";',
  );
  await replaceInFile(
    "web/components/editor/Preview.tsx",
    /ctx\.font = "24px Inter, sans-serif";/g,
    'ctx.font = "500 28px DM Sans, Inter, sans-serif";',
  );

  await replaceInFile(
    "web/components/editor/timeline/Playhead.tsx",
    /className="drop-shadow-\[0_0_8px_rgba\(34,197,94,0\.8\)\]"/g,
    'className="text-primary"',
  );
  await replaceInFile(
    "web/components/editor/timeline/Playhead.tsx",
    /fill="#22c55e"/g,
    'fill="currentColor"',
  );
  await replaceInFile(
    "web/components/editor/timeline/Playhead.tsx",
    /className="absolute w-px bg-primary shadow-\[0_0_10px_#22c55e\]"/g,
    'className="absolute w-px bg-primary"',
  );
}

async function writeProjectNames() {
  const filePath = path.join(vendorDir, "web", "utils", "project-names.ts");
  const content = `const CITY_NAMES = [
  "Studio", "Timeline", "Cut", "Scene", "Vault",
  "Trace", "Reel", "Render", "Sequence", "Canvas",
  "Frame", "Clip", "Export", "Preview", "Mix",
  "Grade", "Motion", "Layer", "Project", "Session",
];

const ADJECTIVES = [
  "Golden", "Velvet", "Circe", "Venus", "Ariadne",
  "Noir", "Lunar", "Radiant", "Violet", "Oracle",
  "Gilded", "Stellar", "Private", "Studio", "Cinematic",
];

export function generateProjectName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const city = CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
  return \`\${adjective} \${city}\`;
}

export function generateSimpleProjectName(): string {
  return CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)];
}
`;
  await writeFile(filePath, content, "utf8");
}

function preserveVendorFiles(): Map<string, Buffer> {
  const preservedFiles = new Map<string, Buffer>();
  for (const relativePath of preservedVendorFiles) {
    const filePath = path.join(vendorDir, relativePath);
    if (existsSync(filePath)) {
      preservedFiles.set(relativePath, readFileSync(filePath));
    }
  }
  return preservedFiles;
}

function restoreVendorFiles(preservedFiles: Map<string, Buffer>) {
  for (const relativePath of preservedVendorFiles) {
    const fileContent = preservedFiles.get(relativePath);
    if (!fileContent) {
      console.warn(`Skipped missing preserved vendor file: vendor/openreel/${relativePath}`);
      continue;
    }

    const filePath = path.join(vendorDir, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, fileContent);
  }
}

async function replaceInFile(relativePath: string, pattern: RegExp, replacement: string) {
  const filePath = path.join(vendorDir, relativePath);
  if (!existsSync(filePath)) {
    throw new Error(`Cannot patch missing file: vendor/openreel/${relativePath}`);
  }

  const original = await readFile(filePath, "utf8");
  const next = original.replace(pattern, replacement);
  if (next !== original) {
    await writeFile(filePath, next, "utf8");
  }
}

async function writeManifest(metadata: Record<string, string>) {
  const packageManifest = readPackageManifest();
  const vendorStats = await countVendorFiles(vendorDir);
  const manifest = {
    ...metadata,
    vendorPath: "vendor/openreel",
    sourceMap: {
      "apps/web/src": "vendor/openreel/web",
      "packages/core/src": "vendor/openreel/core",
      "packages/ui/src": "vendor/openreel/ui",
      "packages/image-core/src": "vendor/openreel/image-core",
    },
    markitPatchPolicy: [
      "Next 16 webpack aliases and browser-only editor entry live outside vendor/openreel.",
      "Vite env references are converted to process.env.",
      "Remote worker imports are converted to package imports.",
      "React 19 ref compatibility is patched for timeline components.",
      "Visible editor branding and project-name generation are patched to Markit.",
      "Premium Markit/Circe styling lives in app/globals.css and should not be overwritten by sync.",
    ],
    packageDependencies: packageManifest.dependencies ?? {},
    packageDevDependencies: packageManifest.devDependencies ?? {},
    vendorStats,
  };

  writeFileSync(
    path.join(vendorDir, "UPSTREAM.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

function readPackageManifest() {
  return JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

async function countVendorFiles(directory: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;

  async function walk(current: string) {
    for (const entry of await readdir(current)) {
      const fullPath = path.join(current, entry);
      const info = await stat(fullPath);
      if (info.isDirectory()) {
        await walk(fullPath);
      } else {
        files += 1;
        bytes += info.size;
      }
    }
  }

  await walk(directory);
  return { files, bytes };
}

function git(commandArgs: string[], cwd: string) {
  const result = spawnSync("git", commandArgs, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${commandArgs.join(" ")} failed`);
  }

  return result.stdout;
}

function run(command: string, commandArgs: string[], cwd: string, options?: { allowFailure?: boolean }) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0 && !options?.allowFailure) {
    throw new Error(`${command} ${commandArgs.join(" ")} failed`);
  }
}
