#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use std::collections::{BTreeMap, HashSet};
use napi::bindgen_prelude::*;

#[napi(object)]
pub struct MergeInput {
  pub base_tree: String,
  pub ours_tree: String,
  pub theirs_tree: String,
}

#[napi(object)]
pub struct MergeResult {
  pub success: bool,
  pub conflict_files: Vec<String>,
  pub merged_tree: String,
}

pub struct MergeTask {
  pub base_tree: String,
  pub ours_tree: String,
  pub theirs_tree: String,
}

#[napi]
impl Task for MergeTask {
  type Output = MergeResult;
  type JsValue = MergeResult;

  fn compute(&mut self) -> Result<Self::Output> {
    // Parse the flat JSON trees
    let base: BTreeMap<String, String> = serde_json::from_str(&self.base_tree).unwrap_or_default();
    let ours: BTreeMap<String, String> = serde_json::from_str(&self.ours_tree).unwrap_or_default();
    let theirs: BTreeMap<String, String> = serde_json::from_str(&self.theirs_tree).unwrap_or_default();

    let mut all_paths = HashSet::new();
    all_paths.extend(base.keys().cloned());
    all_paths.extend(ours.keys().cloned());
    all_paths.extend(theirs.keys().cloned());

    let mut merged = BTreeMap::new();
    let mut conflicts = Vec::new();

    for path in all_paths {
        let base_hash = base.get(&path);
        let ours_hash = ours.get(&path);
        let theirs_hash = theirs.get(&path);

        // Both sides are identical
        if ours_hash == theirs_hash {
            if let Some(hash) = ours_hash {
                merged.insert(path, hash.clone());
            }
            continue;
        }

        // Ours did not change -> take theirs
        if ours_hash == base_hash {
            if let Some(hash) = theirs_hash {
                merged.insert(path, hash.clone());
            }
            continue;
        }

        // Theirs did not change -> keep ours
        if theirs_hash == base_hash {
            if let Some(hash) = ours_hash {
                merged.insert(path, hash.clone());
            }
            continue;
        }

        // Both changed differently -> conflict
        conflicts.push(path);
    }

    if !conflicts.is_empty() {
        conflicts.sort();
        return Ok(MergeResult {
            success: false,
            conflict_files: conflicts,
            merged_tree: "{}".to_string(),
        });
    }

    // Serialize the successful merged tree
    let merged_json = serde_json::to_string(&merged).unwrap_or_else(|_| "{}".to_string());

    Ok(MergeResult {
        success: true,
        conflict_files: vec![],
        merged_tree: merged_json,
    })
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi]
pub fn perform_merge_async(input: MergeInput) -> AsyncTask<MergeTask> {
  AsyncTask::new(MergeTask {
    base_tree: input.base_tree,
    ours_tree: input.ours_tree,
    theirs_tree: input.theirs_tree,
  })
}
