# 🛰️ Content publishing

The initial map list comes from OverFast commit `6ca950ec3ed2b3419b2b89beb9fbf3f5bad77405`. It was retrieved through GitHub on 2026-10-12. The current hero list and ability names were then refreshed from all 54 official hero pages. The latest retail patch title is “Overwatch Retail Patch Notes – October 6, 2026”. File hashes and retrieval dates are in `content/source-evidence.json` and `content/live-evidence.json`. No artwork or full official page prose is copied into the app.

```sh
npm run content:capture
python3 scripts/import-live.py
npx tsx scripts/apply-coaching.ts
npm run schemas
npm run content:validate
npm run content:verify-live
npm run content:release
```

The source capture saves raw pages outside the checkout. Importing metadata invalidates tactical review; the coaching tool applies original text and leaves review pending. The separate `seed-snapshot.py` tool writes an archived source snapshot under `release`, never over the current app data. `verify-live` captures official page hashes and compares roster IDs; it does not claim that biographies, mechanics, or coaching were reviewed. The verifier also checks the latest official patch title. Map rotation and tactical correctness still need independent review. `content:release` intentionally fails on the candidate's incomplete data.

## 📝 Review a new package

Use stable IDs. Record the actual patch, source URLs, retrieval dates, reviewer dates, and confidence. Numeric ability values need sources; leave unavailable values out. Matchups are editorial evidence, not empirical win rates. Mark guides and relationships stale when relevant mechanics or the game patch changes. User data must stay outside content packages.

The publisher compares packages when `OWGUIDE_PREVIOUS_CONTENT` is set and marks affected relationships stale. Review the resulting package before approving a production package. Changes never grant approval automatically. Accurate map geometry requires both source evidence and redistribution rights; the Rust updater currently accepts text-only maps and rejects image packages.

## 🔑 Create your own trust key

Use an Ed25519 key outside the checkout. For example, on a trusted publishing machine:

```sh
openssl genpkey -algorithm ED25519 -out /secure/location/owguide-content.pem
OWGUIDE_SIGNING_KEY_FILE=/secure/location/owguide-content.pem npm run content:publish -- src/data/content.json https://your-domain.example/owguide/
```

This command validates and signs the exact content bytes. It creates a versioned package, manifest, and public-key file in `release/content`. It does not upload them or deploy a server. Keep the private key secret. Compile the public key into the desktop build as `OWGUIDE_CONTENT_PUBLIC_KEY`.

Upload the versioned package to your HTTPS host first, then replace `manifest.json` last. Use the manifest URL in Settings. The package must stay on the same origin. Static hosting can serve the files. There is no polling or fake default feed. The user requests an update explicitly.

The Rust client checks size, SHA-256, Ed25519, schema, references, and version. Installation is atomic. A failed download or validation keeps the active offline package. “Restore previous content” swaps in the retained package and does not alter notes or favorites.

## 🧯 Limits

No live feed has been deployed, no key is configured in this build, and network update success has not been tested against a real publishing endpoint. Cryptographic verification, SQLite install failure, rollback, and user-data preservation are covered by unit tests. Key rotation, remote asset caching, release-grade DNS defenses, and automatic binary updates remain unfinished.

## 📖 Ability summaries

`content/ability-summaries.json` contains original summaries of mechanics described by the captured official hero pages. Run `python3 scripts/apply-abilities.py` after source capture. It stops if ability names or list lengths change. The source hashes are recorded in `content/ability-evidence.json`. It copies no images or full page text. These summaries establish basic mechanics, not cooldowns, damage values, complete passive coverage, or balance approval. Unconfirmed ability types stay `unknown`.
