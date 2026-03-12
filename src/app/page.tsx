import { Suspense } from "react";
import { HomeContent, ArticleSkeleton } from "@/components/HomeContent";
import { getSources, getArticlesForSources } from "@/lib/feeds";
import type { Article } from "@/types";

export default async function HomePage() {
  let initialArticles: Article[] = [];
  let initialSourcesKey = "";
  try {
    const sources = await getSources();
    initialArticles = await getArticlesForSources(sources);
    initialSourcesKey = sources.map((s) => s.id).sort().join(",");
  } catch {
    // Fall through with empty — client will fetch on mount
  }

  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <HomeContent
        initialArticles={initialArticles}
        initialSourcesKey={initialSourcesKey}
      />
    </Suspense>
  );
}
