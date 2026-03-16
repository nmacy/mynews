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
import { useSourceGroups, sourceColor } from "@/components/layout/SourceBar";

function SortableSourceGroup({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: sourceColor(name),
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
      {name}
    </button>
  );
}

export function SourceBarSection() {
  const { sourceBarOrder, setSourceBarOrder } = useConfig();
  const groups = useSourceGroups();
  const [sourceSearch, setSourceSearch] = useState("");

  const allGroupNames = groups.map((g) => g.name);
  const isCustomized = sourceBarOrder.length > 0;
  const orderedSet = new Set(sourceBarOrder);
  const unordered = allGroupNames.filter((n) => !orderedSet.has(n));
  const filteredUnordered = sourceSearch
    ? unordered.filter((n) => n.toLowerCase().includes(sourceSearch.toLowerCase()))
    : unordered;

  const removeGroup = (name: string) => {
    setSourceBarOrder(sourceBarOrder.filter((n) => n !== name));
  };

  const addGroup = (name: string) => {
    setSourceBarOrder([...sourceBarOrder, name]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sourceBarOrder.indexOf(active.id as string);
      const newIndex = sourceBarOrder.indexOf(over.id as string);
      setSourceBarOrder(arrayMove(sourceBarOrder, oldIndex, newIndex));
    }
  };

  if (allGroupNames.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Source Bar</h3>
        {isCustomized && (
          <button
            onClick={() => setSourceBarOrder([])}
            className="text-sm font-medium"
            style={{ color: "var(--mn-accent)" }}
          >
            Reset order
          </button>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: "var(--mn-muted)" }}>
        Drag to reorder. Click to remove. Sources with the same name are grouped into one pill.
      </p>

      {sourceBarOrder.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--mn-muted)" }}>
            Ordered
          </p>
          <DndContext
            id="source-bar-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext items={sourceBarOrder} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-wrap gap-2 mb-4">
                {sourceBarOrder.map((name) => {
                  if (!allGroupNames.includes(name)) return null;
                  return (
                    <SortableSourceGroup
                      key={name}
                      name={name}
                      onRemove={() => removeGroup(name)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {unordered.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--mn-muted)" }}>
              {isCustomized ? "Remaining" : "All sources"}
            </p>
            <input
              type="text"
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
              placeholder="Search sources..."
              className="flex-1 max-w-[200px] px-2.5 py-1 text-sm rounded-md outline-none"
              style={{
                backgroundColor: "var(--mn-bg)",
                color: "var(--mn-fg)",
                border: "1px solid var(--mn-border)",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredUnordered.length === 0 && (
              <p className="text-sm" style={{ color: "var(--mn-muted)" }}>No sources found</p>
            )}
            {filteredUnordered.map((name) => (
              <button
                key={name}
                onClick={() => addGroup(name)}
                className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--mn-muted)",
                  border: "1px solid var(--mn-border)",
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
