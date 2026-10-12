import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { invalidateChangedContent } from "../src/domain/content-review";
import { contentSchema } from "../src/domain/schema";
const input = process.argv[2] ?? "src/data/content.json",
  base = process.argv[3];
if (!base || !/^https:\/\//.test(base))
  throw new Error(
    "Provide a public HTTPS publishing directory as the second argument.",
  );
const keyPath = process.env.OWGUIDE_SIGNING_KEY_FILE;
if (!keyPath)
  throw new Error(
    "Set OWGUIDE_SIGNING_KEY_FILE to a private Ed25519 PEM outside the repository.",
  );
let c = contentSchema.parse(JSON.parse(readFileSync(input, "utf8")));
const previous = process.env.OWGUIDE_PREVIOUS_CONTENT;
if (previous) {
  const old = contentSchema.parse(JSON.parse(readFileSync(previous, "utf8")));
  c = invalidateChangedContent(old, c);
}
const key = createPrivateKey(readFileSync(keyPath));
if (key.asymmetricKeyType !== "ed25519")
  throw new Error("Use an Ed25519 publisher key.");
const bytes = Buffer.from(JSON.stringify(c) + "\n");
const publicDer = createPublicKey(key).export({ type: "spki", format: "der" });
const name = `content-${c.version}.json`;
mkdirSync("release/content", { recursive: true });
writeFileSync(`release/content/${name}`, bytes);
writeFileSync(
  "release/content/manifest.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      version: c.version,
      packageUrl: new URL(name, base.endsWith("/") ? base : `${base}/`).href,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      signature: sign(null, bytes, key).toString("base64"),
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "release/content/publisher-public-key.txt",
  publicDer.subarray(-32).toString("base64") + "\n",
);
console.log(
  `Signed ${name}. Upload package and manifest to the same origin; upload the manifest last.`,
);
