import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import { isIP } from "node:net";
import { invalidateChangedContent } from "../src/domain/content-review";
import { contentSchema, contentStructureSchema } from "../src/domain/schema";
const input = process.argv[2] ?? "src/data/content.json",
  base = process.argv[3];
let destination: URL;
try {
  destination = new URL(base ?? "");
} catch {
  throw new Error(
    "Provide a public HTTPS publishing directory as the second argument.",
  );
}
const host = destination.hostname.replace(/\.$/, "");
if (
  destination.protocol !== "https:" ||
  destination.username ||
  destination.password ||
  destination.port ||
  !host.includes(".") ||
  host === "localhost" ||
  host.endsWith(".localhost") ||
  host.endsWith(".local") ||
  host.endsWith(".home.arpa") ||
  isIP(host) ||
  host.startsWith("[") ||
  destination.search ||
  destination.hash
)
  throw new Error(
    "Use a public HTTPS publishing directory without credentials, custom ports, queries or fragments.",
  );
const keyPath = process.env.OWGUIDE_SIGNING_KEY_FILE;
if (!keyPath)
  throw new Error(
    "Set OWGUIDE_SIGNING_KEY_FILE to a private Ed25519 PEM outside the repository.",
  );
let c = contentStructureSchema.parse(JSON.parse(readFileSync(input, "utf8")));
const previous = process.env.OWGUIDE_PREVIOUS_CONTENT;
if (previous) {
  const old = contentSchema.parse(JSON.parse(readFileSync(previous, "utf8")));
  c = invalidateChangedContent(old, c);
}
c = contentSchema.parse(c);
if (c.maps.some((map) => map.asset !== null || map.markers.length))
  throw new Error("This client currently supports text-only map packages.");
const key = createPrivateKey(readFileSync(keyPath));
if (key.asymmetricKeyType !== "ed25519")
  throw new Error("Use an Ed25519 publisher key.");
const bytes = Buffer.from(JSON.stringify(c) + "\n");
if (bytes.length > 8 * 1024 * 1024)
  throw new Error("Content exceeds the client’s 8 MiB limit.");
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
      packageUrl: new URL(
        name,
        destination.href.endsWith("/")
          ? destination.href
          : `${destination.href}/`,
      ).href,
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
