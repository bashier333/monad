"use client";

import dynamic from "next/dynamic";
import type { BoardLink, BoardType } from "@/app/ontology/model-board";

const ModelBoard = dynamic(() => import("@/app/ontology/model-board"), {
  ssr: false,
  loading: () => <div className="h-[420px] rounded ds-panel" aria-label="Loading model map" />,
});

// Client boundary for the canvas board: next/dynamic with ssr:false is not
// allowed in Server Components, so the Schema page renders this wrapper and
// the wrapper owns the dynamic import (same pattern as the twin charts).
export default function ModelBoardLoader({ types, links }: { types: BoardType[]; links: BoardLink[] }) {
  return <ModelBoard types={types} links={links} />;
}
