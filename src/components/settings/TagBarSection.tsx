"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { useConfig } from "@/components/ConfigProvider";
import { DEFAULT_FEATURED_TAGS } from "@/components/layout/TagTabs";
import { useTagDefinitions, useTagMap } from "@/components/TagProvider";

function SortableTag({
  slug,
  label,
  color,
  onRemove,
}: {
  slug: string;
  label: string;
  color: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: color,
    color: "white",
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors touch-none select-none"
      onClick={onRemove}
      {...attributes}
      {...listeners}
    >
      {label}
    </button>
  );
}

export function TagBarSection() {
  const { featuredTags, setFeaturedTags } = useConfig();
  const TAG_MAP = useTagMap();
  const TAG_DEFINITIONS = useTagDefinitions();
  const [tagSearch, setTagSearch] = useState("");

  const isCustomized =
    featuredTags.length !== DEFAULT_FEATURED_TAGS.length ||
    featuredTags.some((t, i) => t !== DEFAULT_FEATURED_TAGS[i]);

  const featuredSet = new Set(featuredTags);

  const removeTag = (slug: string) => {
    setFeaturedTags(featuredTags.filter((t) => t !== slug));
  };

  const addTag = (slug: string) => {
    setFeaturedTags([...featuredTags, slug]);
  };

  const selectedTags = featuredTags
    .map((slug) => TAG_MAP.get(slug))
    .filter(Boolean);
  const unselectedTags = TAG_DEFINITIONS.filter((t) => !featuredSet.has(t.slug));
  const filteredUnselected = tagSearch
    ? unselectedTags.filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase()))
    : unselectedTags;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = featuredTags.indexOf(active.id as string);
      const newIndex = featuredTags.indexOf(over.id as string);
      setFeaturedTags(arrayMove(featuredTags, oldIndex, newIndex));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Tag Bar</h3>
        {isCustomized && (
          <button
            onClick={() => setFeaturedTags(DEFAULT_FEATURED_TAGS)}
            className="text-sm font-medium"
            style={{ color: "var(--mn-accent)" }}
          >
            Reset to defaults
          </button>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--mn-muted)" }}>
        Drag to reorder. Click to remove. Choose which tags appear in the navigation bar.
      </p>

      {selectedTags.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--mn-muted)" }}>
            Selected
          </p>
          <DndContext
            id="tag-bar-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext items={featuredTags} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTags.map((tag) => {
                  if (!tag) return null;
                  return (
                    <SortableTag
                      key={tag.slug}
                      slug={tag.slug}
                      label={tag.label}
                      color={tag.color}
                      onRemove={() => removeTag(tag.slug)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {unselectedTags.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--mn-muted)" }}>
              Available
            </p>
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tags..."
              className="flex-1 max-w-[200px] px-2.5 py-1 text-sm rounded-md outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                color: "var(--mn-fg)",
                border: "1px solid var(--mn-border)",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredUnselected.length === 0 && (
              <p className="text-sm" style={{ color: "var(--mn-muted)" }}>No tags found</p>
            )}
            {filteredUnselected.map((tag) => (
              <button
                key={tag.slug}
                onClick={() => addTag(tag.slug)}
                className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--mn-muted)",
                  border: "1px solid var(--mn-border)",
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
