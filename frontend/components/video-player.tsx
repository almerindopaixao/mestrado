"use client"

import { useCallback, useEffect, useRef } from "react"
import type { FrameAnnotation } from "@/lib/types"
import { formatTimestamp } from "@/lib/types"

interface VideoPlayerProps {
  videoUrl: string
  annotations: FrameAnnotation[]
  onTimeUpdate: (time: number) => void
  seekTo?: number | null
}

export function VideoPlayer({
  videoUrl,
  annotations,
  onTimeUpdate,
  seekTo,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (seekTo !== null && seekTo !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekTo
      videoRef.current.play().catch(() => {})
    }
  }, [seekTo])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime)
    }
  }, [onTimeUpdate])

  const duration = videoRef.current?.duration || 0

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-lg bg-muted">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          className="w-full aspect-video"
          aria-label="Player de video da aula"
        >
          <track kind="descriptions" label="Descricoes de elementos visuais" />
          Seu navegador nao suporta o elemento de video.
        </video>
      </div>

      {annotations.length > 0 && duration > 0 && (
        <div
          ref={progressRef}
          role="img"
          aria-label={`Mapa de anotacoes: ${annotations.length} elementos figurados encontrados ao longo do video`}
          className="relative h-3 rounded-full bg-muted overflow-hidden"
        >
          {annotations.map((ann) => {
            const left = (ann.timestamp / duration) * 100
            return (
              <button
                key={ann.id}
                className="absolute top-0 h-full w-1.5 bg-primary hover:bg-primary/80 rounded-full transition-colors cursor-pointer"
                style={{ left: `${left}%` }}
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = ann.timestamp
                    videoRef.current.play().catch(() => {})
                  }
                }}
                aria-label={`Anotacao em ${formatTimestamp(ann.timestamp)}: ${ann.elementType}`}
                title={`${formatTimestamp(ann.timestamp)} - ${ann.elementType}`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
