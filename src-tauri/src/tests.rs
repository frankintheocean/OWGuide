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
    c["version"] = "99.0.0".into();
    s.install(&c).unwrap();
    assert_eq!(s.snapshot().unwrap().content["version"], "99.0.0");
    s.rollback().unwrap();
    let result = s.snapshot().unwrap();
    assert_eq!(result.content["version"], seed()["version"]);
    assert_eq!(result.user.unwrap(), user());
}
#[test]
fn failed_sql_transaction_restores_previous_package() {
    let mut s = Store::open(Path::new(":memory:")).unwrap();
    s.connection.execute_batch("CREATE TEMP TRIGGER reject_install BEFORE INSERT ON hero BEGIN SELECT RAISE(ABORT,'test fault'); END;").unwrap();
    let mut c = seed();
    c["version"] = "99.0.0".into();
    assert!(s.install(&c).is_err());
    assert_eq!(s.snapshot().unwrap().content["version"], seed()["version"]);
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
        version: seed()["version"].as_str().unwrap().into(),
        package_url: "https://example.com/content.json".into(),
        sha256: hex::encode(Sha256::digest(&bytes)),
        bytes: bytes.len(),
        signature: STANDARD.encode(signing.sign(&bytes).to_bytes()),
    };
    assert!(verify_package(&manifest, &bytes, &key).is_ok());
    manifest.version = "99.0.0".into();
    assert!(verify_package(&manifest, &bytes, &key).is_err());
    manifest.version = seed()["version"].as_str().unwrap().into();
    manifest.bytes += 1;
    assert!(verify_package(&manifest, &bytes, &key).is_err());
    manifest.bytes -= 1;
    manifest.schema_version = 99;
    assert!(verify_package(&manifest, &bytes, &key).is_err());
    manifest.schema_version = 1;
    assert!(verify_package(&manifest, &bytes, &STANDARD.encode([8; 32])).is_err());
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
        "https://localhost./x",
        "https://app.localhost/x",
        "https://machine.local./x",
        "https://machine.home.arpa/x",
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

#[test]
fn invalid_publisher_key_is_rejected_before_any_network_work() {
    assert!(
        fetch_update("https://example.com/manifest.json", "0.3.0", "bad-key")
            .unwrap_err()
            .contains("publisher key")
    );
}
#[test]
fn duplicate_guide_levels_and_stats_are_rejected() {
    let mut c = seed();
    let guide = c["heroes"][0]["guides"][0].clone();
    c["heroes"][0]["guides"].as_array_mut().unwrap().push(guide);
    assert!(validate_content(&c)
        .unwrap_err()
        .contains("Duplicate guide"));
    let mut c = seed();
    let stat = serde_json::json!({"name":"TEST STAT","value":1,"unit":"test only","sourceId":c["sources"][0]["id"]});
    c["heroes"][0]["abilities"][0]["stats"] = serde_json::json!([stat, stat]);
    assert!(validate_content(&c)
        .unwrap_err()
        .contains("Duplicate statistic"));
}

#[test]
fn background_initialization_is_shared_by_all_window_requests() {
    let dir = tempfile::tempdir().unwrap();
    let db = std::sync::Arc::new(BackgroundStore::start(dir.path().join("async.sqlite")).unwrap());
    let threads: Vec<_> = (0..4)
        .map(|_| {
            let db = db.clone();
            std::thread::spawn(move || {
                db.with_store(|store| {
                    Ok(store.snapshot()?.content["heroes"]
                        .as_array()
                        .unwrap()
                        .len())
                })
            })
        })
        .collect();
    for thread in threads {
        assert_eq!(thread.join().unwrap().unwrap(), 54);
    }
    db.with_store(|store| store.save_user(&user(), 0)).unwrap();
    assert_eq!(
        db.with_store(|store| Ok(store.snapshot()?.user))
            .unwrap()
            .unwrap(),
        user()
    );
}
#[test]
fn background_initialization_failure_preserves_the_database_and_reports_consistently() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("newer.sqlite");
    let db = Connection::open(&path).unwrap();
    db.execute_batch("PRAGMA user_version=99;").unwrap();
    drop(db);
    let store = BackgroundStore::start(path.clone()).unwrap();
    for _ in 0..2 {
        assert!(store
            .with_store(|db| db.snapshot())
            .err()
            .unwrap()
            .contains("newer"));
    }
    assert_eq!(
        Connection::open(path)
            .unwrap()
            .query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        99
    );
    assert!(dir.path().join("startup-error.log").is_file());
}

#[test]
fn explicit_initialization_retry_keeps_notes_after_the_underlying_error_is_corrected() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("retry.sqlite");
    {
        let mut store = Store::open(&path).unwrap();
        store.save_user(&user(), 0).unwrap();
    }
    {
        let db = Connection::open(&path).unwrap();
        db.execute_batch("PRAGMA user_version=99;").unwrap();
    }
    let store = BackgroundStore::start(path.clone()).unwrap();
    assert!(store.with_store(|s| s.snapshot()).is_err());
    {
        let db = Connection::open(path).unwrap();
        db.execute_batch("PRAGMA user_version=2;").unwrap();
    }
    // The cached failure stays stable until an explicit retry is requested.
    assert!(store.with_store(|s| s.snapshot()).is_err());
    store.retry_failed().unwrap();
    assert_eq!(
        store
            .with_store(|s| Ok(s.snapshot()?.user))
            .unwrap()
            .unwrap(),
        user()
    );
    // Retry on a healthy store must not replace or reset it.
    store.retry_failed().unwrap();
    assert_eq!(store.with_store(|s| Ok(s.snapshot()?.revision)).unwrap(), 1);
}

#[test]
fn geometry_migration_preserves_existing_settings_and_portable_isolation() {
    let dir = tempfile::tempdir().unwrap();
    let legacy = dir.path().join("legacy.json");
    fs::write(&legacy, r#"{"main":{"width":1200},"quick":{"width":340}}"#).unwrap();
    let root = dir.path().join("data");
    fs::create_dir(&root).unwrap();
    let migrated = window_state_path(&root, Some(&legacy)).unwrap();
    assert_eq!(fs::read(&migrated).unwrap(), fs::read(&legacy).unwrap());
    fs::write(&migrated, "new window positions").unwrap();
    window_state_path(&root, Some(&legacy)).unwrap();
    assert_eq!(
        fs::read_to_string(&migrated).unwrap(),
        "new window positions"
    );
    let portable = dir.path().join("portable");
    fs::create_dir(&portable).unwrap();
    let isolated = window_state_path(&portable, None).unwrap();
    assert!(!isolated.exists());
    assert!(legacy.is_file());
}

#[test]
fn unicode_text_limits_match_the_frontend_without_installing_unreadable_content() {
    let mut u = user();
    u["notes"]["ana"] = "🙂".repeat(12000).into();
    assert!(validate_user(&u).is_ok());
    u["notes"]["ana"] = "🙂".repeat(12001).into();
    assert!(validate_user(&u).is_err());
    let mut c = seed();
    c["heroes"][0]["biography"] = "🙂".repeat(12001).into();
    let mut store = Store::open(Path::new(":memory:")).unwrap();
    assert!(store.install(&c).is_err());
    assert_eq!(store.snapshot().unwrap().content, seed());
}

#[test]
fn active_content_reviews_require_the_current_patch_and_a_date() {
    let mut value = seed();
    let patch = value["patch"].clone();
    let date = value["generatedAt"].clone();
    value["matchups"][0]["explanation"] = serde_json::json!("TEST FIXTURE for review metadata");
    value["matchups"][0]["review"]["stale"] = serde_json::json!(false);
    value["matchups"][0]["review"]["patch"] = patch;
    value["matchups"][0]["review"]["reviewedAt"] = Value::Null;
    assert!(validate_content(&value).is_err());
    value["matchups"][0]["review"]["reviewedAt"] = date;
    assert!(validate_content(&value).is_ok());
    value["matchups"][0]["review"]["patch"] = serde_json::json!("TEST OLD PATCH");
    assert!(validate_content(&value).is_err());
}
