"use client"

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Upload,
  ScanEye,
  BrainCircuit,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { ProcessingState } from "@/lib/types"

interface ProcessingStatusProps {
  state: ProcessingState
}

const STAGE_ORDER = [
  "uploading",
  "detecting_scenes",
  "detecting_elements",
  "analyzing_ai",
  "complete",
] as const

function getStageIndex(status: ProcessingState["status"]): number {
  const map: Record<string, number> = {
    uploading: 0,
    detecting_scenes: 1,
    detecting_elements: 2,
    analyzing_ai: 3,
    complete: 4,
  }
  return map[status] ?? -1
}

export function ProcessingStatus({ state }: ProcessingStatusProps) {
  const {
    status,
    totalScenes,
    currentScene,
    framesWithElements,
    aiProcessed,
    aiTotal,
    message,
    annotations,
    processingTime,
  } = state

  if (status === "idle") return null

  // Progresso geral baseado nas etapas
  let overallProgress = 0
  if (status === "uploading") {
    overallProgress = 5
  } else if (status === "detecting_scenes") {
    overallProgress = 15
  } else if (status === "detecting_elements") {
    overallProgress =
      totalScenes > 0
        ? 20 + (currentScene / totalScenes) * 40
        : 30
  } else if (status === "analyzing_ai") {
    overallProgress =
      aiTotal > 0 ? 60 + (aiProcessed / aiTotal) * 35 : 70
  } else if (status === "complete") {
    overallProgress = 100
  }
  
  const stages = [
    {
      key: "uploading",
      label: "Envio do video",
      icon: Upload,
    },
    {
      key: "detecting_scenes",
      label: "Descoberta de cenas",
      icon: ScanEye,
    },
    {
      key: "detecting_elements",
      label: "Identificacao de elementos",
      icon: Search,
    },
    {
      key: "analyzing_ai",
      label: "Descricao por IA",
      icon: BrainCircuit,
    },
  ]

  const currentStageIdx = getStageIndex(status)

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Status do processamento"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      {/* Mensagem principal */}
      <div className="flex items-center gap-3">
        {status === "error" ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        ) : status === "complete" ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
        ) : (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
        )}
        <span className="text-sm font-medium text-foreground">
          {status === "error"
            ? state.errorMessage || "Ocorreu um erro durante o processamento."
            : message}
        </span>
      </div>

      {/* Barra de progresso geral */}
      {status !== "error" && (
        <div className="flex flex-col gap-1.5">
          <Progress
            value={overallProgress}
            className="h-2.5"
            aria-label={`Progresso geral: ${Math.round(overallProgress)}%`}
          />
          <span className="text-xs text-muted-foreground text-right">
            {Math.round(overallProgress)}%
          </span>
        </div>
      )}

      {/* Etapas do pipeline */}
      {status !== "error" && (
        <div className="flex flex-col gap-2 pt-1">
          {stages.map((stage, idx) => {
            const Icon = stage.icon
            const isDone = currentStageIdx > idx || status === "complete"
            const isActive =
              status !== "complete" && currentStageIdx === idx
            const isPending = currentStageIdx < idx && status !== "complete"

            let detail = ""
            if (stage.key === "detecting_scenes" && isDone && totalScenes > 0) {
              detail = `${totalScenes} cenas detectadas`
            } else if (
              stage.key === "detecting_elements" &&
              (isDone || isActive)
            ) {
              if (isActive && totalScenes > 0) {
                detail = `${currentScene}/${totalScenes} frames`
              } else if (isDone) {
                detail = `${framesWithElements} com elementos`
              }
            } else if (stage.key === "analyzing_ai" && (isDone || isActive)) {
              if (isActive && aiTotal > 0) {
                detail = `${aiProcessed}/${aiTotal} descricoes`
              } else if (isDone) {
                detail = `${annotations.length} descricoes geradas`
              }
            }

            return (
              <div
                key={stage.key}
                className={`flex items-center gap-2.5 text-sm ${
                  isDone
                    ? "text-accent"
                    : isActive
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isPending ? "opacity-40" : ""}`}
                  />
                )}
                <span>{stage.label}</span>
                {detail && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {detail}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sumario final */}
      {status === "complete" && (
        <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground border-t">
          <span>
            {totalScenes} cenas analisadas
          </span>
          <span>
            {framesWithElements} elementos encontrados
          </span>
          <span>
            {annotations.length} descricoes geradas
          </span>
          {processingTime > 0 && (
            <span>
              {processingTime}s de processamento
            </span>
          )}
        </div>
      )}
    </div>
  )
}
