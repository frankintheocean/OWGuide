//! ⏳ Initialize SQLite on one worker, then share its result across window commands.
use crate::{Result, Store};
use std::{path::PathBuf, sync::Mutex, thread::JoinHandle};

enum Initialization {
    Pending(Option<JoinHandle<Result<Store>>>),
    Ready(Result<Store>),
}
pub struct BackgroundStore {
    path: PathBuf,
    state: Mutex<Initialization>,
}
impl BackgroundStore {
    fn worker(path: PathBuf) -> Result<JoinHandle<Result<Store>>> {
        std::thread::Builder::new()
            .name("owguide-database".into())
            .spawn(move || {
                Store::open(&path).inspect_err(|error| {
                    if let Some(parent) = path.parent() {
                        let _ = std::fs::write(parent.join("startup-error.log"), error);
                    }
                })
            })
            .map_err(|_| "Could not start the database worker".to_owned())
    }
    pub fn start(path: PathBuf) -> Result<Self> {
        let worker = Self::worker(path.clone())?;
        Ok(Self {
            path,
            state: Mutex::new(Initialization::Pending(Some(worker))),
        })
    }
    /// Retry only an initialization failure, after the user explicitly requests it.
    pub fn retry_failed(&self) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| "Database lock failed")?;
        if matches!(&*state, Initialization::Ready(Err(_))) {
            *state = Initialization::Pending(Some(Self::worker(self.path.clone())?));
        }
        Ok(())
    }
    /// Call from a blocking worker, never from the window event thread.
    pub fn with_store<T>(&self, f: impl FnOnce(&mut Store) -> Result<T>) -> Result<T> {
        let mut state = self.state.lock().map_err(|_| "Database lock failed")?;
        if let Initialization::Pending(worker) = &mut *state {
            let worker = worker
                .take()
                .ok_or("Database worker result is unavailable")?;
            *state = Initialization::Ready(
                worker
                    .join()
                    .unwrap_or_else(|_| Err("Database worker stopped unexpectedly".into())),
            );
        }
        match &mut *state {
            Initialization::Ready(Ok(store)) => f(store),
            Initialization::Ready(Err(error)) => Err(error.clone()),
            Initialization::Pending(_) => Err("Database initialization is incomplete".into()),
        }
    }
}
