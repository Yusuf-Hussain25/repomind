// Shared analyze pipeline: fetch → multi-agent graph → embed.
//
// Called by the BullMQ worker (preferred) and by the inline fallback in the
// analyze route (used when no worker is running).

import { getRepo, updateRepo, saveContext, loadContext } from "./store";
import { fetchRepoFiles, buildContextDocument } from "./github";
import { runAnalyzer } from "./agents/graph";
import { parseContextDoc } from "./agents/parse";
import { embedRepo } from "./embed";
import type { StreamEvent } from "./queue";

export interface RunPipelineOptions {
  repoId: string;
  emit: (event: StreamEvent) => void;
}

/**
 * Drive a repo from "queued" through "complete". Streams every progress
 * and agent event via `emit`. Throws on hard failures (caller decides
 * whether to convert to an SSE error event).
 */
export async function runAnalyzePipeline(opts: RunPipelineOptions): Promise<void> {
  const { repoId, emit } = opts;
  const repo = await getRepo(repoId);
  if (!repo) throw new Error(`Repo not found: ${repoId}`);

  emit({ stage: "queued", progress: 5, message: "Starting analysis…" });

  let contextDoc = await loadContext(repo.id);

  if (!contextDoc) {
    await updateRepo(repo.id, { status: "fetching" });
    emit({
      stage: "fetching_meta",
      progress: 10,
      message: `Reading ${repo.owner}/${repo.name}…`,
    });
    emit({ stage: "fetching_tree", progress: 20, message: "Listing files…" });

    const { files, totalBytes } = await fetchRepoFiles(
      repo.owner,
      repo.name,
      repo.defaultBranch,
      {
        onProgress: (loaded, target) => {
          const pct = 25 + Math.floor((loaded / Math.max(target, 1)) * 30);
          emit({
            stage: "fetching_files",
            progress: pct,
            message: `Fetched ${loaded} of ${target} files`,
            fileCount: loaded,
          });
        },
      },
    );

    if (files.length === 0) {
      throw new Error("No analyzable text files found in this repository.");
    }

    contextDoc = buildContextDocument(repo.url, files);
    await saveContext(repo.id, contextDoc);
    await updateRepo(repo.id, {
      fileCount: files.length,
      totalBytes,
      topFiles: files.slice(0, 12).map((f) => ({ path: f.path, size: f.size })),
    });
    emit({
      stage: "fetching_files",
      progress: 55,
      message: `Indexed ${files.length} files (${Math.round(totalBytes / 1024)} KB)`,
      fileCount: files.length,
      totalBytes,
    });
  } else {
    emit({ stage: "fetching_files", progress: 55, message: "Reusing indexed files" });
  }

  await updateRepo(repo.id, { status: "analyzing" });
  emit({ stage: "analyzing", progress: 60, message: "Spinning up agents…" });

  const { finalReport } = await runAnalyzer({
    repoId: repo.id,
    repoUrl: repo.url,
    contextDoc,
    emit: (event) => emit(event),
  });

  await updateRepo(repo.id, { status: "ready", analysis: finalReport });

  // Phase 1 embedding pass — idempotent.
  const skipEmbed =
    !process.env.PINECONE_API_KEY || repo.embeddingStatus === "ready";

  if (!skipEmbed) {
    try {
      await updateRepo(repo.id, { embeddingStatus: "embedding" });
      emit({
        stage: "embedding",
        progress: 92,
        message: "Embedding repo into Pinecone…",
      });

      const parsedFiles = parseContextDoc(contextDoc);
      const { chunkCount, fileCount } = await embedRepo(
        repo.id,
        parsedFiles,
        ({ embedded, total }) => {
          const pct = 92 + Math.floor((embedded / Math.max(total, 1)) * 7);
          emit({
            stage: "embedding",
            progress: pct,
            message: `Embedded ${embedded} / ${total} chunks`,
            chunkCount: embedded,
          });
        },
      );

      await updateRepo(repo.id, {
        embeddingStatus: "ready",
        embeddedChunkCount: chunkCount,
        embeddedAt: new Date().toISOString(),
      });
      emit({
        stage: "embedding",
        progress: 99,
        message: `Indexed ${chunkCount} chunks across ${fileCount} files`,
        chunkCount,
        fileCount,
      });
    } catch (embedErr) {
      const msg = embedErr instanceof Error ? embedErr.message : "Embedding failed";
      await updateRepo(repo.id, { embeddingStatus: "error" });
      emit({
        stage: "embedding",
        progress: 99,
        message: `Embedding failed: ${msg}`,
      });
    }
  }

  emit({ stage: "complete", progress: 100, message: "Analysis complete" });
}
