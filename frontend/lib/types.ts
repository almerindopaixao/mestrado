// --- Deteccoes YOLO ---
export interface YOLODetection {
  class_name: string
  confidence: number
  bbox: [number, number, number, number]
}

// --- Frames do backend ---
export interface BackendFrame {
  timestamp: number
  scene_start: number
  scene_end: number
  scene_index: number
  image_base64: string
  detections: YOLODetection[]
}

// --- Anotacoes (frame + descricao IA) ---
export interface FrameAnnotation {
  id: string
  timestamp: number
  sceneStart: number
  sceneEnd: number
  thumbnailDataUrl: string
  elementType: string
  description: string
  yoloDetections: YOLODetection[]
  aiConfidence: number
}

// --- Eventos SSE do backend ---
export interface SSEProgressEvent {
  type: "progress"
  stage: "upload" | "scenes" | "yolo" | "ai" | "done"
  current?: number
  total?: number
  message: string
}

export interface SSESceneCountEvent {
  type: "scene_count"
  total_scenes: number
}

export interface SSEFrameDetectedEvent {
  type: "frame_detected"
  frame: BackendFrame
}

export interface SSECompleteEvent {
  type: "complete"
  summary: {
    total_scenes: number
    total_analyzed: number
    frames_with_elements: number
    processing_time: number
  }
}

export interface SSEErrorEvent {
  type: "error"
  message: string
}

export type SSEEvent =
  | SSEProgressEvent
  | SSESceneCountEvent
  | SSEFrameDetectedEvent
  | SSECompleteEvent
  | SSEErrorEvent

// --- Estado do processamento ---
export interface ProcessingState {
  status: "idle" | "uploading" | "detecting_scenes" | "detecting_elements" | "analyzing_ai" | "complete" | "error"
  totalScenes: number
  currentScene: number
  framesWithElements: number
  aiProcessed: number
  aiTotal: number
  message: string
  detectedFrames: BackendFrame[]
  annotations: FrameAnnotation[]
  processingTime: number
  errorMessage?: string
}

// --- Resposta da API de analise IA ---
export interface AnalyzeFrameResponse {
  contem_elemento: boolean
  tipo_elemento: string
  descricao: string
}

// --- Utilidades ---
export const ELEMENT_TYPE_LABELS: Record<string, string> = {
  "table": "Tabela",
  "chart-graph": "Gráfico",
  "visual-illustration": "Ilustração Visual",
  "photographic-image": "Imagem Fotográfica",
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

export function getTopDetectionLabel(detections: YOLODetection[]): string {
  if (!detections.length) return "Elemento"
  const top = detections.reduce((a, b) => (a.confidence > b.confidence ? a : b))
  return ELEMENT_TYPE_LABELS[top.class_name] || top.class_name
}

export function getInitialProcessingState(): ProcessingState {
  return {
    status: "idle",
    totalScenes: 0,
    currentScene: 0,
    framesWithElements: 0,
    aiProcessed: 0,
    aiTotal: 0,
    message: "",
    detectedFrames: [],
    annotations: [],
    processingTime: 0,
  }
}
