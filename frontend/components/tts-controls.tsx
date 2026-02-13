"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Volume2, VolumeX, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [rate, setRate] = useState(1)
  const [voiceIndex, setVoiceIndex] = useState<number>(-1)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    function loadVoices() {
      const allVoices = window.speechSynthesis.getVoices()
      const ptVoices = allVoices.filter(
        (v) => v.lang.startsWith("pt-BR") || v.lang.startsWith("pt")
      )
      const available = ptVoices.length > 0 ? ptVoices : allVoices.slice(0, 5)
      setVoices(available)
      if (available.length > 0 && voiceIndex === -1) {
        setVoiceIndex(0)
      }
    }

    loadVoices()
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices)
    }
  }, [voiceIndex])

  const speak = useCallback(
    (text: string) => {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "pt-BR"
      utterance.rate = rate

      if (voices.length > 0 && voiceIndex >= 0 && voiceIndex < voices.length) {
        utterance.voice = voices[voiceIndex]
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [rate, voices, voiceIndex]
  )

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  return { speak, stop, isSpeaking, rate, setRate, voices, voiceIndex, setVoiceIndex }
}

export function TTSControlsPanel({
  autoMode,
  onAutoModeChange,
  rate,
  onRateChange,
  isSpeaking,
  onStop,
}: {
  autoMode: boolean
  onAutoModeChange: (enabled: boolean) => void
  rate: number
  onRateChange: (rate: number) => void
  isSpeaking: boolean
  onStop: () => void
}) {
  return (
    <div
      role="region"
      aria-label="Controles de leitura em voz alta"
      className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-3"
    >
      <div className="flex items-center gap-2">
        {isSpeaking ? (
          <Volume2 className="h-4 w-4 text-primary animate-pulse" />
        ) : (
          <VolumeX className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">
          Leitura por voz
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="auto-tts" className="text-xs text-muted-foreground">
          Modo automatico
        </Label>
        <Switch
          id="auto-tts"
          checked={autoMode}
          onCheckedChange={onAutoModeChange}
          aria-label="Ativar leitura automatica das descricoes durante reproducao do video"
        />
      </div>

      <div className="flex items-center gap-2 min-w-[160px]">
        <Label htmlFor="tts-speed" className="text-xs text-muted-foreground whitespace-nowrap">
          Velocidade: {rate.toFixed(1)}x
        </Label>
        <Slider
          id="tts-speed"
          min={0.5}
          max={2}
          step={0.1}
          value={[rate]}
          onValueChange={([v]) => onRateChange(v)}
          aria-label={`Velocidade da fala: ${rate.toFixed(1)}x`}
          className="w-24"
        />
      </div>

      {isSpeaking && (
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          aria-label="Parar leitura em voz"
          className="h-7"
        >
          <Square className="h-3 w-3" />
          Parar
        </Button>
      )}
    </div>
  )
}
