-- Persist review vote counters so likes/dislikes are DB-backed
ALTER TABLE "Review"
ADD COLUMN "helpfulCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "notHelpfulCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill counters from existing ReviewVote rows
UPDATE "Review" r
SET "helpfulCount" = COALESCE(v.helpful_count, 0),
    "notHelpfulCount" = COALESCE(v.not_helpful_count, 0)
FROM (
  SELECT
    "reviewId",
    COUNT(*) FILTER (WHERE vote = 'HELPFUL')::INTEGER AS helpful_count,
    COUNT(*) FILTER (WHERE vote = 'NOT_HELPFUL')::INTEGER AS not_helpful_count
  FROM "ReviewVote"
  GROUP BY "reviewId"
) v
WHERE r.id = v."reviewId";
