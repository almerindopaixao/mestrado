"use client"

import { Clock, Volume2, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { FrameAnnotation } from "@/lib/types"
import { formatTimestamp, ELEMENT_TYPE_LABELS } from "@/lib/types"

interface AnnotationCardProps {
  annotation: FrameAnnotation
  isActive: boolean
  onSeek: (timestamp: number) => void
  onSpeak: (text: string) => void
}

export function AnnotationCard({
  annotation,
  isActive,
  onSeek,
  onSpeak,
}: AnnotationCardProps) {
  const typeLabel =
    ELEMENT_TYPE_LABELS[annotation.elementType] || annotation.elementType

  // Melhor detecção YOLO (maior confianca)
  const topDetection = annotation.yoloDetections?.length
    ? annotation.yoloDetections.reduce((a, b) =>
        a.confidence > b.confidence ? a : b
      )
    : null

  const yoloLabel = topDetection
    ? ELEMENT_TYPE_LABELS[topDetection.class_name] || topDetection.class_name
    : null

  const yoloConfidence = topDetection
    ? Math.round(topDetection.confidence * 100)
    : null

  return (
    <article
      aria-label={`Anotacao em ${formatTimestamp(annotation.timestamp)}: ${typeLabel}`}
      aria-current={isActive ? "true" : undefined}
      className={`flex gap-3 rounded-lg border p-3 transition-colors ${
        isActive
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:bg-accent/10"
      }`}
    >
      <div className="shrink-0">
        <img
          src={annotation.thumbnailDataUrl}
          alt={`Miniatura do frame em ${formatTimestamp(annotation.timestamp)}`}
          className="h-16 w-24 rounded-md object-cover bg-muted"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge YOLO com confianca */}
          {yoloLabel && yoloConfidence !== null && (
            <Badge
              variant="default"
              className="text-xs shrink-0"
            >
              {yoloLabel} - {yoloConfidence}%
            </Badge>
          )}

          {/* Badge do tipo da descricao IA */}
          {annotation.description && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {typeLabel}
            </Badge>
          )}

          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTimestamp(annotation.timestamp)}
          </span>
        </div>

        {annotation.description ? (
          <p className="text-sm text-foreground leading-relaxed line-clamp-3">
            {annotation.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Aguardando descricao da IA...
          </p>
        )}

        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onSeek(annotation.timestamp)}
            aria-label={`Ir para ${formatTimestamp(annotation.timestamp)} no video`}
          >
            <Play className="h-3 w-3" />
            Ir ao trecho
          </Button>
          {annotation.description && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onSpeak(annotation.description)}
              aria-label={`Ouvir descricao: ${typeLabel}`}
            >
              <Volume2 className="h-3 w-3" />
              Ouvir
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
