mod background;
pub use background::BackgroundStore;
use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::Duration,
};
pub type Result<T> = std::result::Result<T, String>;
const MAX_CONTENT: usize = 8 * 1024 * 1024;
const MAX_USER: usize = 2 * 1024 * 1024;

fn validate_schema(value: &Value, schema: &str) -> Result<()> {
    let schema: Value = serde_json::from_str(schema).map_err(|e| e.to_string())?;
    let validator = jsonschema::options()
        .should_validate_formats(true)
        .build(&schema)
        .map_err(|e| e.to_string())?;
    validator
        .validate(value)
        .map_err(|e| format!("Data validation failed: {e}"))
}

pub fn validate_content(value: &Value) -> Result<()> {
    validate_schema(value, include_str!("../../content/content.schema.json"))?;
    let ids = |key: &str| -> Result<HashSet<String>> {
        let rows = value[key].as_array().ok_or("Missing rows")?;
        let set: HashSet<String> = rows
            .iter()
            .map(|r| r["id"].as_str().unwrap_or_default().to_owned())
            .collect();
        if set.len() != rows.len() {
            return Err(format!("Duplicate {key} ID"));
        }
        Ok(set)
    };
    let heroes = ids("heroes")?;
    let maps = ids("maps")?;
    let sources = ids("sources")?;
    for key in ["heroes", "maps", "matchups", "synergies", "mapFit"] {
        let mut relationships = HashSet::new();
        for row in value[key].as_array().ok_or("Missing rows")? {
            if !sources.contains(row["review"]["sourceId"].as_str().unwrap_or_default()) {
                return Err("Unknown review source".into());
            }
            let review = &row["review"];
            if review["stale"].as_bool() == Some(false)
                && (review["patch"] != value["patch"] || review["reviewedAt"].is_null())
            {
                return Err("Active reviews need a date and the current patch".into());
            }
            if key == "heroes" {
                let mut levels = HashSet::new();
                for guide in row["guides"].as_array().ok_or("Missing guides")? {
                    if !levels.insert(guide["level"].as_str().unwrap_or_default()) {
                        return Err("Duplicate guide level".into());
                    }
                }
                if let Some(perks) = row["perks"].as_array() {
                    let mut perk_ids = HashSet::new();
                    for perk in perks {
                        if !perk_ids.insert(perk["id"].as_str().unwrap_or_default()) {
                            return Err("Duplicate perk".into());
                        }
                        if !sources
                            .contains(perk["review"]["sourceId"].as_str().unwrap_or_default())
                        {
                            return Err("Unknown perk source".into());
                        }
                        let review = &perk["review"];
                        if review["stale"] == false
                            && (review["reviewedAt"].is_null() || review["patch"] != value["patch"])
                        {
                            return Err(
                                "Active perk reviews need a date and the current patch".into()
                            );
                        }
                    }
                }
                let mut abilities = HashSet::new();
                for a in row["abilities"].as_array().ok_or("Missing abilities")? {
                    if !abilities.insert(a["id"].as_str().unwrap_or_default()) {
                        return Err("Duplicate ability".into());
                    }
                    let mut stats = HashSet::new();
                    for s in a["stats"].as_array().ok_or("Missing stats")? {
                        if !stats.insert(s["name"].as_str().unwrap_or_default()) {
                            return Err("Duplicate statistic name".into());
                        }
                        if !sources.contains(s["sourceId"].as_str().unwrap_or_default()) {
                            return Err("Unknown statistic source".into());
                        }
                    }
                }
            } else if key == "maps" {
                let markers = row["markers"].as_array().ok_or("Missing markers")?;
                let mut marker_ids = HashSet::new();
                for marker in markers {
                    if !marker_ids.insert(marker["id"].as_str().unwrap_or_default()) {
                        return Err("Duplicate map marker".into());
                    }
                }
                if !markers.is_empty() && row["asset"].is_null() {
                    return Err("Map coordinates need a licensed asset".into());
                }
                if !row["asset"].is_null() {
                    if !sources.contains(row["asset"]["sourceId"].as_str().unwrap_or_default()) {
                        return Err("Unknown asset source".into());
                    }
                    // External images are deliberately unsupported until a separate asset verifier ships.
                    return Err(
                        "Image content packages are not supported; use the text fallback".into(),
                    );
                }
                for p in markers {
                    if !sources.contains(p["sourceId"].as_str().unwrap_or_default())
                        || p["heroIds"]
                            .as_array()
                            .ok_or("Missing marker heroes")?
                            .iter()
                            .any(|id| !heroes.contains(id.as_str().unwrap_or_default()))
                    {
                        return Err("Invalid marker reference".into());
                    }
                }
            } else {
                let hero = row["heroId"].as_str().unwrap_or_default();
                if !heroes.contains(hero) {
                    return Err("Unknown relationship hero".into());
                }
                let target_key = if key == "matchups" {
                    "enemyId"
                } else if key == "synergies" {
                    "allyId"
                } else {
                    "mapId"
                };
                let target = row[target_key].as_str().unwrap_or_default();
                if (target_key == "mapId" && !maps.contains(target))
                    || (target_key != "mapId" && (!heroes.contains(target) || target == hero))
                {
                    return Err("Invalid relationship target".into());
                }
                if !relationships.insert(format!("{hero}:{target}")) {
                    return Err("Duplicate relationship".into());
                }
            }
        }
    }
    if value["rosterVerified"] == true && value["liveVerifiedAt"].is_null() {
        return Err("Verified roster needs a live timestamp".into());
    }
    Ok(())
}
pub fn validate_user(value: &Value) -> Result<()> {
    validate_schema(value, include_str!("../../content/user.schema.json"))?;
    for key in [
        "favorites",
        "recent",
        "bookmarks",
        "completedDrills",
        "widgets",
    ] {
        let rows = value[key].as_array().ok_or("Missing personal data array")?;
        let unique: HashSet<&str> = rows.iter().filter_map(Value::as_str).collect();
        if unique.len() != rows.len() {
            return Err(format!("Duplicate {key} entries"));
        }
    }
    let shortcuts = &value["settings"]["navigationShortcuts"];
    let mut letters = HashSet::new();
    for (action, fallback) in [
        ("home", "h"),
        ("heroes", "e"),
        ("counter", "c"),
        ("maps", "m"),
        ("compare", "p"),
        ("journal", "n"),
        ("settings", "s"),
        ("quick", "q"),
    ] {
        let letter = shortcuts
            .get(action)
            .and_then(Value::as_str)
            .unwrap_or(fallback);
        if !letter.is_empty() && !letters.insert(letter) {
            return Err("Navigation shortcut letters must be unique".into());
        }
    }
    Ok(())
}
pub fn data_root(executable: &Path, installed_root: &Path) -> Result<PathBuf> {
    let parent = executable.parent().ok_or("Executable has no parent")?;
    let root = if parent.join("portable.marker").is_file() {
        parent.join("OWGuideData")
    } else {
        installed_root.to_path_buf()
    };
    fs::create_dir_all(&root).map_err(|e| format!("Data folder is not writable: {e}"))?;
    Ok(root)
}
pub struct Store {
    connection: Connection,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub revision: i64,
    pub user: Option<Value>,
    pub content: Value,
}
impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let mut connection = Connection::open(path).map_err(|e| e.to_string())?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(|e| e.to_string())?;
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
            )
            .map_err(|e| e.to_string())?;
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if version > 2 {
            return Err(
                "Database is newer than this application. Use a newer OWGuide version.".into(),
            );
        }
        if version == 0 {
            connection
                .execute_batch(concat!(
                    "BEGIN IMMEDIATE;",
                    include_str!("../migrations/001.sql"),
                    "COMMIT;"
                ))
                .map_err(|e| e.to_string())?;
        }
        if version < 2 {
            let tx = connection.transaction().map_err(|e| e.to_string())?;
            tx.execute_batch(include_str!("../migrations/002.sql"))
                .map_err(|e| e.to_string())?;
            let previous: Option<String> = tx
                .query_row("SELECT payload FROM content_package WHERE id=1", [], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(|e| e.to_string())?;
            if let Some(payload) = previous {
                let data: Value = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
                validate_content(&data)?;
                for row in data["synergies"].as_array().ok_or("Missing synergies")? {
                    tx.execute(
                        "INSERT INTO synergy VALUES (?1,?2,?3)",
                        params![
                            row["heroId"].as_str(),
                            row["allyId"].as_str(),
                            row.to_string()
                        ],
                    )
                    .map_err(|e| e.to_string())?;
                }
                for row in data["mapFit"].as_array().ok_or("Missing map fit")? {
                    tx.execute(
                        "INSERT INTO map_fit VALUES (?1,?2,?3)",
                        params![
                            row["heroId"].as_str(),
                            row["mapId"].as_str(),
                            row.to_string()
                        ],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
            tx.commit().map_err(|e| e.to_string())?;
        }
        let mut store = Self { connection };
        let exists: bool = store
            .connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM content_package WHERE id=1)",
                [],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if !exists {
            let seed = serde_json::from_str(include_str!("../../src/data/content.json"))
                .map_err(|e| e.to_string())?;
            store.install(&seed)?;
        }
        Ok(store)
    }
    pub fn source_allowed(&self, url: &str) -> Result<bool> {
        safe_url(url)?;
        Ok(self.snapshot()?.content["sources"]
            .as_array()
            .ok_or("Missing content sources")?
            .iter()
            .any(|source| source["url"].as_str() == Some(url)))
    }
    pub fn snapshot(&self) -> Result<Snapshot> {
        let state: Option<(i64, String)> = self
            .connection
            .query_row(
                "SELECT revision,payload FROM user_state WHERE id=1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let content: String = self
            .connection
            .query_row("SELECT payload FROM content_package WHERE id=1", [], |r| {
                r.get(0)
            })
            .map_err(|e| e.to_string())?;
        let (revision, user) = match state {
            Some((r, p)) => (
                r,
                Some(serde_json::from_str(&p).map_err(|e| e.to_string())?),
            ),
            None => (0, None),
        };
        Ok(Snapshot {
            revision,
            user,
            content: serde_json::from_str(&content).map_err(|e| e.to_string())?,
        })
    }
    pub fn save_user(&mut self, value: &Value, expected_revision: i64) -> Result<i64> {
        validate_user(value)?;
        let payload = serde_json::to_string(value).map_err(|e| e.to_string())?;
        if payload.len() > MAX_USER {
            return Err("Personal data exceeds 2 MiB".into());
        }
        let tx = self
            .connection
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(|e| e.to_string())?;
        let revision: i64 = tx
            .query_row("SELECT revision FROM user_state WHERE id=1", [], |r| {
                r.get(0)
            })
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or(0);
        if revision != expected_revision {
            return Err(
                "Another window changed your data. Reload and retry; your changes were not saved."
                    .into(),
            );
        }
        tx.execute("INSERT INTO user_state VALUES (1,?1,?2) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload",params![revision+1,payload]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(revision + 1)
    }
    pub fn install(&mut self, value: &Value) -> Result<()> {
        validate_content(value)?;
        let payload = serde_json::to_string(value).map_err(|e| e.to_string())?;
        if payload.len() > MAX_CONTENT {
            return Err("Content exceeds 8 MiB".into());
        }
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO content_package SELECT 2,version,payload FROM content_package WHERE id=1 ON CONFLICT(id) DO UPDATE SET version=excluded.version,payload=excluded.payload",[]).map_err(|e|e.to_string())?;
        tx.execute_batch("DELETE FROM map_fit; DELETE FROM synergy; DELETE FROM matchup; DELETE FROM ability; DELETE FROM hero; DELETE FROM game_map; DELETE FROM source;").map_err(|e|e.to_string())?;
        for row in value["sources"].as_array().ok_or("Missing sources")? {
            tx.execute(
                "INSERT INTO source VALUES (?1,?2)",
                params![row["id"].as_str(), row.to_string()],
            )
            .map_err(|e| e.to_string())?;
        }
        for row in value["heroes"].as_array().ok_or("Missing heroes")? {
            tx.execute(
                "INSERT INTO hero VALUES (?1,?2,?3)",
                params![
                    row["id"].as_str(),
                    row["review"]["sourceId"].as_str(),
                    row.to_string()
                ],
            )
            .map_err(|e| e.to_string())?;
            for a in row["abilities"].as_array().ok_or("Missing abilities")? {
                tx.execute(
                    "INSERT INTO ability VALUES (?1,?2,?3)",
                    params![a["id"].as_str(), row["id"].as_str(), a.to_string()],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        for row in value["maps"].as_array().ok_or("Missing maps")? {
            tx.execute(
                "INSERT INTO game_map VALUES (?1,?2,?3)",
                params![
                    row["id"].as_str(),
                    row["review"]["sourceId"].as_str(),
                    row.to_string()
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        for row in value["matchups"].as_array().ok_or("Missing matchups")? {
            tx.execute(
                "INSERT INTO matchup VALUES (?1,?2,?3)",
                params![
                    row["heroId"].as_str(),
                    row["enemyId"].as_str(),
                    row.to_string()
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        for row in value["synergies"].as_array().ok_or("Missing synergies")? {
            tx.execute(
                "INSERT INTO synergy VALUES (?1,?2,?3)",
                params![
                    row["heroId"].as_str(),
                    row["allyId"].as_str(),
                    row.to_string()
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        for row in value["mapFit"].as_array().ok_or("Missing map fit")? {
            tx.execute(
                "INSERT INTO map_fit VALUES (?1,?2,?3)",
                params![
                    row["heroId"].as_str(),
                    row["mapId"].as_str(),
                    row.to_string()
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.execute("INSERT INTO content_package VALUES (1,?1,?2) ON CONFLICT(id) DO UPDATE SET version=excluded.version,payload=excluded.payload",params![value["version"].as_str(),payload]).map_err(|e|e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }
    pub fn rollback(&mut self) -> Result<()> {
        let p: String = self
            .connection
            .query_row("SELECT payload FROM content_package WHERE id=2", [], |r| {
                r.get(0)
            })
            .map_err(|_| "No previous content package".to_owned())?;
        let v = serde_json::from_str(&p).map_err(|e| e.to_string())?;
        self.install(&v)
    }
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Manifest {
    pub schema_version: u32,
    pub version: String,
    pub package_url: String,
    pub sha256: String,
    pub bytes: usize,
    pub signature: String,
}
fn publisher_key(raw: &str) -> Result<VerifyingKey> {
    let key: [u8; 32] = STANDARD
        .decode(raw)
        .map_err(|_| "Invalid publisher key")?
        .try_into()
        .map_err(|_| "Invalid publisher key length")?;
    VerifyingKey::from_bytes(&key).map_err(|_| "Invalid publisher key".into())
}
pub fn verify_package(manifest: &Manifest, bytes: &[u8], key: &str) -> Result<Value> {
    if manifest.schema_version != 1 || manifest.bytes != bytes.len() || bytes.len() > MAX_CONTENT {
        return Err("Content manifest size or schema is invalid".into());
    }
    if hex::encode(Sha256::digest(bytes)) != manifest.sha256 {
        return Err("Content checksum mismatch".into());
    }
    let key = publisher_key(key)?;
    let signature = Signature::from_slice(
        &STANDARD
            .decode(&manifest.signature)
            .map_err(|_| "Invalid signature")?,
    )
    .map_err(|_| "Invalid signature length")?;
    // Sign exact package bytes, not a JSON reserialization. Version is checked against signed data below.
    key.verify_strict(bytes, &signature)
        .map_err(|_| "Publisher signature did not verify")?;
    let value: Value = serde_json::from_slice(bytes).map_err(|e| e.to_string())?;
    validate_content(&value)?;
    if value["version"].as_str() != Some(manifest.version.as_str()) {
        return Err("Manifest version does not match signed content".into());
    }
    Ok(value)
}
pub fn safe_url(raw: &str) -> Result<reqwest::Url> {
    let u = reqwest::Url::parse(raw).map_err(|_| "Invalid URL")?;
    let host = u
        .host_str()
        .ok_or("URL needs a host")?
        .trim_end_matches('.');
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || u.port().is_some()
        || host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".home.arpa")
        || !host.contains('.')
        || host.ends_with(".local")
        || host.parse::<std::net::IpAddr>().is_ok()
        || host.starts_with('[')
    {
        return Err("Use a public HTTPS hostname with no credentials or custom port".into());
    }
    Ok(u)
}
fn download(
    client: &reqwest::blocking::Client,
    url: reqwest::Url,
    limit: usize,
) -> Result<Vec<u8>> {
    let response = client
        .get(url)
        .send()
        .map_err(|_| "Cannot reach the content server. Your offline content is unchanged.")?
        .error_for_status()
        .map_err(|e| {
            format!(
                "Content server returned an error: {}",
                e.status().map(|s| s.as_u16()).unwrap_or(0)
            )
        })?;
    let mut bytes = Vec::new();
    response
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| "Download failed")?;
    if bytes.len() > limit {
        return Err("Download exceeds the size limit".into());
    }
    Ok(bytes)
}
pub fn fetch_update(endpoint: &str, current: &str, key: &str) -> Result<Value> {
    publisher_key(key)?;
    let endpoint = safe_url(endpoint)?;
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let manifest: Manifest = serde_json::from_slice(&download(&client, endpoint.clone(), 16384)?)
        .map_err(|_| "Invalid content manifest")?;
    let url = safe_url(&manifest.package_url)?;
    if url.origin() != endpoint.origin() {
        return Err("Package must use the same origin as the manifest".into());
    }
    let version = |s: &str| -> Result<Vec<u32>> {
        let parts: Vec<u32> = s
            .split('.')
            .map(|v| v.parse::<u32>().map_err(|_| "Invalid version".to_owned()))
            .collect::<Result<_>>()?;
        if parts.len() != 3 {
            return Err("Invalid version".into());
        }
        Ok(parts)
    };
    if version(&manifest.version)? <= version(current)? {
        return Err("No newer content package is available".into());
    }
    verify_package(&manifest, &download(&client, url, MAX_CONTENT)?, key)
}
#[cfg(test)]
mod tests;

/// 🧳 Keep geometry beside the database and preserve older installed window settings.
pub fn window_state_path(root: &Path, previous: Option<&Path>) -> Result<PathBuf> {
    let destination = root.join("windows.json");
    if !destination.exists() {
        if let Some(previous) = previous.filter(|path| path.is_file()) {
            if fs::metadata(previous).map_err(|e| e.to_string())?.len() > 65536 {
                return Err("Previous window settings are too large. Back them up before resetting window placement.".into());
            }
            fs::copy(previous, &destination)
                .map_err(|e| format!("Could not preserve previous window settings: {e}"))?;
        }
    }
    Ok(destination)
}
