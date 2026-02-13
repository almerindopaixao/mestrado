"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { VideoUpload } from "@/components/video-upload"
import { VideoPlayer } from "@/components/video-player"
import { AnnotationTimeline } from "@/components/annotation-timeline"
import { ProcessingStatus } from "@/components/processing-status"
import { TTSControlsPanel, useTTS } from "@/components/tts-controls"
import { Button } from "@/components/ui/button"
import type {
  ProcessingState,
  FrameAnnotation,
  AnalyzeFrameResponse,
  BackendFrame,
  SSEEvent,
} from "@/lib/types"
import { getInitialProcessingState, getTopDetectionLabel } from "@/lib/types"
import { RotateCcw, Eye, MonitorPlay } from "lucide-react"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
const CONCURRENT_AI_REQUESTS = 3

// --- Helpers ---
async function analyzeFrameWithAI(
  frame: BackendFrame
): Promise<AnalyzeFrameResponse | null> {
  try {
    const response = await fetch("/api/analyze-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: `data:image/jpeg;base64,${frame.image_base64}`,
        timestamp: frame.timestamp,
      }),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function backendFrameToAnnotation(
  frame: BackendFrame,
  index: number
): FrameAnnotation {
  return {
    id: `ann-${index}-${frame.timestamp}`,
    timestamp: frame.timestamp,
    sceneStart: frame.scene_start,
    sceneEnd: frame.scene_end,
    thumbnailDataUrl: `data:image/jpeg;base64,${frame.image_base64}`,
    elementType: getTopDetectionLabel(frame.detections),
    description: "",
    yoloDetections: frame.detections,
    aiConfidence: 0,
  }
}

async function parseSSEStream(
  response: Response,
  onEvent: (event: SSEEvent) => void
) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Sem corpo na resposta")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith("data: ")) {
        const data = trimmed.slice(6).trim()
        if (data === "[DONE]") return
        try {
          const event: SSEEvent = JSON.parse(data)
          onEvent(event)
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

export default function HomePage() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState<ProcessingState>(
    getInitialProcessingState()
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState<number | null>(null)
  const [autoTTS, setAutoTTS] = useState(false)
  const lastSpokenRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { speak, stop, isSpeaking, rate, setRate } = useTTS()

  const runAIAnalysis = useCallback(
    async (detectedFrames: BackendFrame[]) => {
      if (detectedFrames.length === 0) {
        setProcessing((prev) => ({
          ...prev,
          status: "complete",
          message: `Processamento concluido. Nenhum elemento figurado encontrado.`,
        }))
        return
      }

      setProcessing((prev) => ({
        ...prev,
        status: "analyzing_ai",
        aiTotal: detectedFrames.length,
        aiProcessed: 0,
        message: `Gerando descricoes acessiveis... (0/${detectedFrames.length})`,
      }))

      let processed = 0

      async function processOne(frame: BackendFrame, index: number) {
        const result = await analyzeFrameWithAI(frame)
        processed++

        setProcessing((prev) => {
          const updatedAnnotations = prev.annotations.map((ann) => {
            if (ann.id === `ann-${index}-${frame.timestamp}` && result) {
              return {
                ...ann,
                description: result.descricao || ann.description,
                elementType: result.tipo_elemento || ann.elementType,
                aiConfidence:  0,
              }
            }
            return ann
          })

          const isDone = processed >= detectedFrames.length

          return {
            ...prev,
            aiProcessed: processed,
            annotations: updatedAnnotations,
            status: isDone ? "complete" : "analyzing_ai",
            message: isDone
              ? `Concluido! ${updatedAnnotations.filter((a) => a.description).length} descricoes geradas.`
              : `Gerando descricoes acessiveis... (${processed}/${detectedFrames.length})`,
          }
        })
      }

      // Processar em batches concorrentes
      let idx = 0
      async function worker() {
        while (idx < detectedFrames.length) {
          const currentIdx = idx++
          await processOne(detectedFrames[currentIdx], currentIdx)
        }
      }

      const workers = Array.from(
        { length: Math.min(CONCURRENT_AI_REQUESTS, detectedFrames.length) },
        () => worker()
      )
      await Promise.all(workers)
    },
    []
  )

  const handleVideoSelected = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file)
      setVideoFile(file)
      setVideoUrl(url)

      const initial = getInitialProcessingState()
      setProcessing({
        ...initial,
        status: "uploading",
        message: "Enviando video para processamento...",
      })

      const formData = new FormData()
      formData.append("file", file)

      abortRef.current = new AbortController()

      try {
        const response = await fetch(`${BACKEND_URL}/api/process-video`, {
          method: "POST",
          body: formData,
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || `Erro do servidor: ${response.status}`)
        }

        const collectedFrames: BackendFrame[] = []

        await parseSSEStream(response, (event) => {
          switch (event.type) {
            case "progress": {
              const stageMap: Record<string, ProcessingState["status"]> = {
                upload: "uploading",
                scenes: "detecting_scenes",
                yolo: "detecting_elements",
                done: "complete",
              }
              const newStatus = stageMap[event.stage] || processing.status

              setProcessing((prev) => ({
                ...prev,
                status: event.stage === "done" ? prev.status : newStatus,
                currentScene: event.current ?? prev.currentScene,
                totalScenes: event.total ?? prev.totalScenes,
                message: event.message,
              }))
              break
            }

            case "scene_count": {
              setProcessing((prev) => ({
                ...prev,
                totalScenes: event.total_scenes,
                status: "detecting_elements",
                message: `${event.total_scenes} cenas detectadas. Analisando frames...`,
              }))
              break
            }

            case "frame_detected": {
              const frame = event.frame
              collectedFrames.push(frame)
              const annotation = backendFrameToAnnotation(
                frame,
                collectedFrames.length - 1
              )

              setProcessing((prev) => ({
                ...prev,
                framesWithElements: collectedFrames.length,
                detectedFrames: [...prev.detectedFrames, frame],
                annotations: [...prev.annotations, annotation].sort(
                  (a, b) => a.timestamp - b.timestamp
                ),
              }))
              break
            }

            case "complete": {
              setProcessing((prev) => ({
                ...prev,
                processingTime: event.summary.processing_time,
                totalScenes: event.summary.total_scenes,
                framesWithElements: event.summary.frames_with_elements,
                message: `Descoberta concluida: ${event.summary.frames_with_elements} elementos em ${event.summary.total_scenes} cenas.`,
              }))
              break
            }

            case "error": {
              setProcessing((prev) => ({
                ...prev,
                status: "error",
                errorMessage: event.message,
                message: event.message,
              }))
              break
            }
          }
        })

        await runAIAnalysis(collectedFrames)
      } catch (error) {
        if ((error as Error).name === "AbortError") return

        setProcessing((prev) => ({
          ...prev,
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Erro desconhecido durante o processamento.",
          message: "Erro durante o processamento.",
        }))
      }
    },
    [runAIAnalysis]
  )

  const handleSeek = useCallback((timestamp: number) => {
    setSeekTo(timestamp)
    setTimeout(() => setSeekTo(null), 100)
  }, [])

  const handleSpeak = useCallback(
    (text: string) => {
      speak(text)
    },
    [speak]
  )

  // Auto-TTS
  useEffect(() => {
    if (!autoTTS || processing.annotations.length === 0) return

    const active = processing.annotations.find(
      (ann) =>
        ann.description &&
        currentTime >= ann.timestamp &&
        currentTime < ann.timestamp + 4
    )

    if (active && lastSpokenRef.current !== active.id) {
      lastSpokenRef.current = active.id
      speak(active.description)
    }
  }, [autoTTS, currentTime, processing.annotations, speak])

  const handleReset = useCallback(() => {
    stop()
    abortRef.current?.abort()
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoFile(null)
    setVideoUrl(null)
    setProcessing(getInitialProcessingState())
    setCurrentTime(0)
    setSeekTo(null)
    lastSpokenRef.current = null
  }, [videoUrl, stop])

  const isProcessing =
    processing.status === "uploading" ||
    processing.status === "detecting_scenes" ||
    processing.status === "detecting_elements" ||
    processing.status === "analyzing_ai"

  const showResults =
    processing.status === "complete" ||
    (isProcessing && processing.annotations.length > 0)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Ir para o conteudo principal
      </a>

      <header className="border-b bg-card" role="banner">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Eye className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Projeto
            </h1>
            <p className="text-xs text-muted-foreground">
              Descrição de elementos visuais em videoaulas para acessibilidade
            </p>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6"
      >
        {!videoFile && (
          <div className="mx-auto max-w-2xl">
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                <MonitorPlay className="h-10 w-10 text-primary" />
              </div>
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-foreground text-balance">
                  Torne suas aulas mais acessiveis
                </h2>
                <p className="text-muted-foreground leading-relaxed max-w-lg text-pretty">
                  Faça upload de um video de aula e nossa inteligência artificial
                  ira identificar e descrever automaticamente todos os elementos
                  figurados como diagramas, tabelas e gráficos.
                </p>
              </div>

              <div className="w-full">
                <VideoUpload onVideoSelected={handleVideoSelected} />
              </div>

              <div className="flex flex-col gap-3 text-left w-full max-w-md">
                <h3 className="text-sm font-semibold text-foreground">
                  Como funciona:
                </h3>
                <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      1
                    </span>
                    <span>
                      Faça upload de um vídeo de aula (até 15 minutos)
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      2
                    </span>
                    <span>
                      Descrições acessíveis são geradas por IA e sincronizadas com o vídeo
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      3
                    </span>
                    <span>
                      Use a leitura por voz para ouvir as descrições automaticamente
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {videoFile && videoUrl && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground truncate max-w-[70%]">
                {videoFile.name}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                aria-label="Carregar outro video"
              >
                <RotateCcw className="h-4 w-4" />
                Novo video
              </Button>
            </div>

            {processing.status !== "idle" && (
              <ProcessingStatus state={processing} />
            )}

            {showResults && (
              <>
                <TTSControlsPanel
                  autoMode={autoTTS}
                  onAutoModeChange={setAutoTTS}
                  rate={rate}
                  onRateChange={setRate}
                  isSpeaking={isSpeaking}
                  onStop={stop}
                />

                <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
                  <div className="flex flex-col gap-4">
                    <VideoPlayer
                      videoUrl={videoUrl}
                      annotations={processing.annotations}
                      onTimeUpdate={setCurrentTime}
                      seekTo={seekTo}
                    />
                  </div>

                  <aside aria-label="Timeline de anotacoes">
                    <AnnotationTimeline
                      annotations={processing.annotations}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                      onSpeak={handleSpeak}
                    />
                  </aside>
                </div>
              </>
            )}

            {!showResults && processing.status !== "error" && (
              <div className="overflow-hidden rounded-lg bg-muted">
                <video
                  src={videoUrl}
                  className="w-full aspect-video rounded-lg"
                  aria-label="Pre-visualizacao do video"
                />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t bg-card" role="contentinfo">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Prototipo em tecnologia assistiva. Promovendo acessibilidade e autonomia para profissionais
            com deficiencia visual.
          </p>
        </div>
      </footer>
    </div>
  )
}
