/**
 * Maps old source IDs to their canonical SOURCE_LIBRARY IDs.
 * Only includes IDs that actually changed — IDs already matching are omitted.
 */
export const SOURCE_ID_MIGRATION: Record<string, string> = {
  "bbc-top": "bbc-news",
  "verge": "the-verge",
  "ars-tech": "ars-technica",
  "npr-news": "npr",
  "guardian-tech": "the-guardian-technology",
  "nyt-tech": "nyt-technology",
  "bbc-tech": "bbc-technology",
};
