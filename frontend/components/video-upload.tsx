"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, FileVideo, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
const MAX_DURATION_SECONDS = 15 * 60
const MAX_FILE_SIZE_MB = 500
const ACCEPTED_FORMATS = ["video/mp4", "video/webm", "video/quicktime"]

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    const url = URL.createObjectURL(file)
    video.src = url
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Nao foi possivel ler o video"))
    }
  })
}

interface VideoUploadProps {
  onVideoSelected: (file: File) => void
  disabled?: boolean
}

export function VideoUpload({ onVideoSelected, disabled }: VideoUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    async (file: File) => {
      setError(null)
      setIsValidating(true)

      try {
        if (!ACCEPTED_FORMATS.includes(file.type)) {
          setError(
            "Formato nao suportado. Utilize arquivos MP4, WebM ou MOV."
          )
          return
        }

        const fileSizeMB = file.size / (1024 * 1024)
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          setError(
            `Arquivo muito grande (${fileSizeMB.toFixed(0)}MB). O limite e ${MAX_FILE_SIZE_MB}MB.`
          )
          return
        }

        const duration = await getVideoDuration(file)
        if (duration > MAX_DURATION_SECONDS) {
          const mins = Math.floor(duration / 60)
          setError(
            `Video muito longo (${mins} min). O limite e 15 minutos.`
          )
          return
        }

        onVideoSelected(file)
      } catch {
        setError("Erro ao validar o video. Tente novamente.")
      } finally {
        setIsValidating(false)
      }
    },
    [onVideoSelected]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!disabled) setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return

      const file = e.dataTransfer.files[0]
      if (file) validateAndSelect(file)
    },
    [disabled, validateAndSelect]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) validateAndSelect(file)
      if (inputRef.current) inputRef.current.value = ""
    },
    [validateAndSelect]
  )

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/50"
      } ${disabled ? "opacity-60 pointer-events-none" : ""}`}
    >
      <CardContent className="p-0">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Area de upload de video. Arraste e solte ou clique para selecionar."
          aria-disabled={disabled}
          className="flex flex-col items-center justify-center gap-4 p-12 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              if (!disabled) inputRef.current?.click()
            }
          }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            {isValidating ? (
              <FileVideo className="h-8 w-8 text-muted-foreground animate-pulse" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {isValidating
                ? "Validando video..."
                : "Arraste o video da aula aqui"}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {"ou clique para selecionar um arquivo"}
            </p>
            <p className="text-xs text-muted-foreground">
              {"Formatos: MP4, WebM, MOV | Maximo: 15 minutos | Ate 500MB"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isValidating}
            tabIndex={-1}
            aria-hidden="true"
          >
            Selecionar arquivo
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="sr-only"
            onChange={handleFileInput}
            aria-label="Selecionar arquivo de video"
            disabled={disabled}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 px-6 pb-6 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
