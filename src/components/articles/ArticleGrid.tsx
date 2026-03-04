import { ArticleCard } from "./ArticleCard";
import type { Article } from "@/types";

export function ArticleGrid({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">No articles found</p>
        <p className="text-sm mt-1">Check back later for updates</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
