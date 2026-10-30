export type MomentStatus = "COLLECTING" | "THRESHOLD_MET" | "CLIP_REQUESTED" | "CLIP_READY" | "REVIEWED" | "DISMISSED" | "CLIP_FAILED" | "MANUAL_REVIEW"
export type ClipJobStatus = "QUEUED" | "CREATING" | "VERIFYING" | "READY_FOR_REVIEW" | "RETRYABLE_FAILED" | "FAILED" | "MANUAL_REVIEW"
export type AiMetadataStatus = "PENDING" | "READY" | "FAILED_WITH_FALLBACK"

const transitions: Record<MomentStatus, readonly MomentStatus[]> = {
  COLLECTING: ["THRESHOLD_MET", "CLIP_REQUESTED", "REVIEWED", "DISMISSED"],
  THRESHOLD_MET: ["CLIP_REQUESTED", "REVIEWED", "DISMISSED"],
  CLIP_REQUESTED: ["CLIP_READY", "CLIP_FAILED", "MANUAL_REVIEW", "REVIEWED", "DISMISSED"],
  CLIP_READY: ["REVIEWED", "DISMISSED"],
  REVIEWED: ["CLIP_REQUESTED", "REVIEWED", "DISMISSED"],
  DISMISSED: ["CLIP_REQUESTED", "REVIEWED", "DISMISSED"],
  CLIP_FAILED: ["CLIP_REQUESTED", "REVIEWED", "DISMISSED"],
  MANUAL_REVIEW: ["CLIP_REQUESTED", "REVIEWED", "DISMISSED"],
}

export const canTransitionMoment = (from: MomentStatus, to: MomentStatus) => from === to || transitions[from].includes(to)

export const assertMomentTransition = (from: MomentStatus, to: MomentStatus) => {
  if (!canTransitionMoment(from, to)) throw new Error(`INVALID_MOMENT_TRANSITION_${from}_TO_${to}`)
}

const clipTransitions: Record<ClipJobStatus, readonly ClipJobStatus[]> = {
  QUEUED: ["CREATING", "RETRYABLE_FAILED", "FAILED"],
  CREATING: ["VERIFYING", "RETRYABLE_FAILED", "FAILED"],
  VERIFYING: ["VERIFYING", "READY_FOR_REVIEW", "MANUAL_REVIEW", "RETRYABLE_FAILED"],
  READY_FOR_REVIEW: [],
  RETRYABLE_FAILED: ["QUEUED", "FAILED", "CREATING"],
  FAILED: ["QUEUED"],
  MANUAL_REVIEW: ["QUEUED"],
}

export const canTransitionClipJob = (from: ClipJobStatus, to: ClipJobStatus) => from === to || clipTransitions[from].includes(to)

export const assertClipJobTransition = (from: ClipJobStatus, to: ClipJobStatus) => {
  if (!canTransitionClipJob(from, to)) throw new Error(`INVALID_CLIP_TRANSITION_${from}_TO_${to}`)
}
