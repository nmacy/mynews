import { Suspense } from "react";
import { HomeContent, ArticleSkeleton } from "@/components/HomeContent";
import { getRankingConfig } from "@/lib/server-config";

export default async function HomePage() {
  let initialRankingConfig;
  try {
    initialRankingConfig = await getRankingConfig();
  } catch {
    // Fall through — client will get it from feeds response
  }

  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <HomeContent initialRankingConfig={initialRankingConfig} />
    </Suspense>
  );
}
