"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AnnotationCard } from "@/components/annotation-card"
import type { FrameAnnotation } from "@/lib/types"
import { FileSearch } from "lucide-react"

interface AnnotationTimelineProps {
  annotations: FrameAnnotation[]
  currentTime: number
  onSeek: (timestamp: number) => void
  onSpeak: (text: string) => void
}

function findActiveAnnotation(
  annotations: FrameAnnotation[],
  currentTime: number
): string | null {
  if (annotations.length === 0) return null

  let closest: FrameAnnotation | null = null
  let minDiff = Infinity

  for (const ann of annotations) {
    const diff = currentTime - ann.timestamp
    if (diff >= 0 && diff < 5 && diff < minDiff) {
      minDiff = diff
      closest = ann
    }
  }

  return closest?.id || null
}

export function AnnotationTimeline({
  annotations,
  currentTime,
  onSeek,
  onSpeak,
}: AnnotationTimelineProps) {
  const activeId = findActiveAnnotation(annotations, currentTime)
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [activeId])

  if (annotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card p-8 text-center">
        <FileSearch className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Nenhuma anotacao ainda
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            As descricoes dos elementos figurados aparecerao aqui apos o processamento.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground">
          Elementos encontrados
        </h2>
        <span className="text-xs text-muted-foreground">
          {annotations.length} anotac{annotations.length !== 1 ? "oes" : "ao"}
        </span>
      </div>

      <ScrollArea className="h-[calc(100vh-320px)] min-h-[300px]">
        <div className="flex flex-col gap-2 pr-3">
          {annotations.map((annotation) => {
            const isActive = annotation.id === activeId
            return (
              <div
                key={annotation.id}
                ref={isActive ? activeRef : undefined}
              >
                <AnnotationCard
                  annotation={annotation}
                  isActive={isActive}
                  onSeek={onSeek}
                  onSpeak={onSpeak}
                />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
