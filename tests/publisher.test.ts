import { contentSchema } from "../src/domain/schema";
import { afterEach, expect, it } from "vitest";
import { generateKeyPairSync, verify, createHash } from "node:crypto";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import content from "../src/data/content.json";
const temporary: string[] = [];
afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "owguide-publisher-test-"));
  temporary.push(directory);
  const keys = generateKeyPairSync("ed25519");
  const key = join(directory, "ephemeral-test-key.pem");
  writeFileSync(key, keys.privateKey.export({ format: "pem", type: "pkcs8" }), {
    mode: 0o600,
  });
  const input = join(directory, "package.json");
  writeFileSync(input, JSON.stringify(content));
  return { directory, keys, key, input };
}
function publish(f: ReturnType<typeof fixture>, base: string, previous = "") {
  return execFileSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
      resolve("scripts/publish-content.ts"),
      f.input,
      base,
    ],
    {
      cwd: f.directory,
      env: {
        ...process.env,
        OWGUIDE_SIGNING_KEY_FILE: f.key,
        OWGUIDE_PREVIOUS_CONTENT: previous,
      },
      stdio: "pipe",
      timeout: 15000,
    },
  );
}
it("publishes exact signed bytes with matching hashes and a same-origin versioned URL", () => {
  const f = fixture();
  publish(f, "https://publisher.example/owguide/");
  const manifest = JSON.parse(
    readFileSync(join(f.directory, "release/content/manifest.json"), "utf8"),
  );
  const bytes = readFileSync(
    join(f.directory, `release/content/content-${content.version}.json`),
  );
  expect(manifest.packageUrl).toBe(
    `https://publisher.example/owguide/content-${content.version}.json`,
  );
  expect(manifest.bytes).toBe(bytes.length);
  expect(manifest.sha256).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  expect(
    verify(
      null,
      bytes,
      f.keys.publicKey,
      Buffer.from(manifest.signature, "base64"),
    ),
  ).toBe(true);
  expect(
    verify(
      null,
      Buffer.concat([bytes, Buffer.from(" ")]),
      f.keys.publicKey,
      Buffer.from(manifest.signature, "base64"),
    ),
  ).toBe(false);
  expect(
    existsSync(join(f.directory, "release/content/ephemeral-test-key.pem")),
  ).toBe(false);
});
it("rejects private, authenticated or ambiguous publishing endpoints before creating output", () => {
  const f = fixture();
  for (const base of [
    "http://publisher.example/",
    "https://localhost./",
    "https://app.localhost/",
    "https://127.0.0.1/",
    "https://user:password@publisher.example/",
    "https://publisher.example:8443/",
    "https://publisher.example/?query=yes",
    "https://publisher.example/#fragment",
  ]) {
    expect(() => publish(f, base)).toThrow();
    expect(existsSync(join(f.directory, "release"))).toBe(false);
  }
});
it("rejects broken content references before signing", () => {
  const f = fixture();
  const invalid = structuredClone(content);
  invalid.matchups[0].enemyId = "missing-hero";
  writeFileSync(f.input, JSON.stringify(invalid));
  expect(() => publish(f, "https://publisher.example/")).toThrow();
  expect(existsSync(join(f.directory, "release"))).toBe(false);
});

it("marks old reviews stale before validating a changed patch package", () => {
  const f = fixture();
  const previous = contentSchema.parse(structuredClone(content));
  previous.heroes[0].review.stale = false;
  previous.heroes[0].review.reviewedAt = previous.generatedAt;
  previous.heroes[0].review.patch = previous.patch;
  const previousPath = join(f.directory, "previous.json");
  writeFileSync(previousPath, JSON.stringify(previous));
  const next = structuredClone(previous);
  next.patch = "TEST PATCH: synthetic publisher fixture";
  next.version = "99.0.0";
  writeFileSync(f.input, JSON.stringify(next));
  publish(f, "https://publisher.example/", previousPath);
  const installed = JSON.parse(
    readFileSync(
      join(f.directory, "release/content/content-99.0.0.json"),
      "utf8",
    ),
  );
  expect(installed.heroes[0].review.stale).toBe(true);
  expect(installed.heroes[0].review.patch).toBe(previous.patch);
});
