export type RepoStatus = "pending" | "fetching" | "analyzing" | "ready" | "error";

export type EmbeddingStatus = "none" | "embedding" | "ready" | "error";

export interface RepoFile {
  path: string;
  content: string;
  size: number;
}

export interface Repo {
  id: string;
  url: string;
  owner: string;
  name: string;
  defaultBranch: string;
  status: RepoStatus;
  description?: string | null;
  language?: string | null;
  stars?: number;
  fileCount?: number;
  totalBytes?: number;
  topFiles?: { path: string; size: number }[];
  analysis?: string;
  error?: string;
  embeddingStatus?: EmbeddingStatus;
  embeddedChunkCount?: number;
  embeddedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProgressEvent {
  stage:
    | "queued"
    | "fetching_meta"
    | "fetching_tree"
    | "fetching_files"
    | "analyzing"
    | "embedding"
    | "complete"
    | "error";
  progress: number;
  message?: string;
  fileCount?: number;
  totalBytes?: number;
  delta?: string;
  thinking?: string;
  chunkCount?: number;
}
