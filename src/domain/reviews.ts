import type { Review } from "./schema";
export function isCurrentReview(review: Review, patch: string) {
  return !review.stale && review.patch === patch && review.reviewedAt !== null;
}
