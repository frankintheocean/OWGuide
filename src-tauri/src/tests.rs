use super::*;
use ed25519_dalek::{Signer, SigningKey};
fn seed() -> Value {
    serde_json::from_str(include_str!("../../src/data/content.json")).unwrap()
}
fn user() -> Value {
    serde_json::from_str(include_str!("../../tests/user-fixture.json")).unwrap()
}
#[test]
fn migration_and_reopen_preserve_personal_data() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("data.sqlite");
    {
        let mut s = Store::open(&path).unwrap();
        assert_eq!(s.snapshot().unwrap().revision, 0);
        s.save_user(&user(), 0).unwrap();
    }
    let s = Store::open(&path).unwrap();
    assert_eq!(s.snapshot().unwrap().revision, 1);
    assert_eq!(
        s.snapshot().unwrap().user.unwrap()["notes"]["ana"],
        "Keep a retreat corner"
    );
}
#[test]
fn conflicts_are_explicit_and_do_not_overwrite() {
    let mut s = Store::open(Path::new(":memory:")).unwrap();
    s.save_user(&user(), 0).unwrap();
    assert!(s
        .save_user(&user(), 0)
        .unwrap_err()
        .contains("Another window"));
    assert_eq!(s.snapshot().unwrap().revision, 1);
}
#[test]
fn content_install_and_rollback_preserve_user() {
    let mut s = Store::open(Path::new(":memory:")).unwrap();
    s.save_user(&user(), 0).unwrap();
    let mut c = seed();
    c["version"] = "0.3.0".into();
    s.install(&c).unwrap();
    assert_eq!(s.snapshot().unwrap().content["version"], "0.3.0");
    s.rollback().unwrap();
    let result = s.snapshot().unwrap();
    assert_eq!(result.content["version"], "0.2.0");
    assert_eq!(result.user.unwrap(), user());
}
#[test]
fn failed_sql_transaction_restores_previous_package() {
    let mut s = Store::open(Path::new(":memory:")).unwrap();
    s.connection.execute_batch("CREATE TEMP TRIGGER reject_install BEFORE INSERT ON hero BEGIN SELECT RAISE(ABORT,'test fault'); END;").unwrap();
    let mut c = seed();
    c["version"] = "0.3.0".into();
    assert!(s.install(&c).is_err());
    assert_eq!(s.snapshot().unwrap().content["version"], "0.2.0");
    assert_eq!(
        s.connection
            .query_row("SELECT COUNT(*) FROM hero", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        54
    );
}
#[test]
fn invalid_content_never_installs() {
    let mut s = Store::open(Path::new(":memory:")).unwrap();
    let mut c = seed();
    c["matchups"][0]["enemyId"] = "missing".into();
    assert!(s.install(&c).is_err());
    assert_eq!(s.snapshot().unwrap().content, seed());
}
#[test]
fn signatures_hashes_sizes_and_versions_are_checked() {
    let bytes = serde_json::to_vec(&seed()).unwrap();
    let signing = SigningKey::from_bytes(&[7; 32]);
    let key = STANDARD.encode(signing.verifying_key().to_bytes());
    let mut manifest = Manifest {
        schema_version: 1,
        version: "0.2.0".into(),
        package_url: "https://example.com/content.json".into(),
        sha256: hex::encode(Sha256::digest(&bytes)),
        bytes: bytes.len(),
        signature: STANDARD.encode(signing.sign(&bytes).to_bytes()),
    };
    assert!(verify_package(&manifest, &bytes, &key).is_ok());
    manifest.version = "0.3.0".into();
    assert!(verify_package(&manifest, &bytes, &key).is_err());
    manifest.version = "0.2.0".into();
    manifest.signature = STANDARD.encode([0; 64]);
    assert!(verify_package(&manifest, &bytes, &key).is_err());
    manifest.signature = STANDARD.encode(signing.sign(&bytes).to_bytes());
    manifest.sha256 = "0".repeat(64);
    assert!(verify_package(&manifest, &bytes, &key).is_err());
}
#[test]
fn portable_data_is_isolated_and_requires_a_writable_folder() {
    let dir = tempfile::tempdir().unwrap();
    let exe = dir.path().join("OWGuide.exe");
    let installed = dir.path().join("installed");
    assert_eq!(data_root(&exe, &installed).unwrap(), installed);
    fs::write(dir.path().join("portable.marker"), "portable").unwrap();
    assert_eq!(
        data_root(&exe, &installed).unwrap(),
        dir.path().join("OWGuideData")
    );
}
#[test]
fn dangerous_urls_are_rejected() {
    for u in [
        "http://example.com/x",
        "https://localhost/x",
        "https://127.0.0.1/x",
        "https://[::1]/x",
        "https://user:pass@example.com/x",
        "https://example.com:8443/x",
        "https://machine.local/x",
    ] {
        assert!(safe_url(u).is_err(), "{u}");
    }
    assert!(safe_url("https://example.com/content/manifest.json").is_ok());
}
#[test]
fn unknown_database_version_is_not_reset() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("db");
    let c = Connection::open(&p).unwrap();
    c.execute_batch("PRAGMA user_version=99;").unwrap();
    drop(c);
    assert!(Store::open(&p).is_err());
}

#[test]
fn migration_from_v1_keeps_notes_and_adds_relationship_tables() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("v1.sqlite");
    let c = Connection::open(&path).unwrap();
    c.execute_batch(include_str!("../migrations/001.sql"))
        .unwrap();
    c.execute(
        "INSERT INTO user_state VALUES (1,1,?1)",
        params![user().to_string()],
    )
    .unwrap();
    drop(c);
    let s = Store::open(&path).unwrap();
    assert_eq!(s.snapshot().unwrap().user.unwrap(), user());
    assert_eq!(
        s.connection
            .query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        2
    );
    assert_eq!(
        s.connection
            .query_row("SELECT count(*) FROM synergy", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
}
#[test]
fn duplicate_widgets_and_invalid_dates_are_rejected() {
    let mut u = user();
    u["widgets"] = serde_json::json!(["favorites", "favorites"]);
    assert!(validate_user(&u).is_err());
    let mut c = seed();
    c["generatedAt"] = "not-a-date".into();
    assert!(validate_content(&c).is_err());
}

#[test]
fn source_links_are_confined_to_attributed_https_urls() {
    let s = Store::open(Path::new(":memory:")).unwrap();
    let source = seed()["sources"][0]["url"].as_str().unwrap().to_owned();
    assert!(s.source_allowed(&source).unwrap());
    assert!(!s
        .source_allowed("https://example.com/not-a-source")
        .unwrap());
    assert!(s.source_allowed("file:///etc/passwd").is_err());
}
