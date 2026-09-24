import { useAuth } from "@clerk/react";
import { Cancel01Icon, PauseIcon, PlayIcon, VolumeHighIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SpeechAsset } from "@ngertiin/contracts/api";
import { type JSX, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { getLessonSpeech, requestLessonSpeech } from "../../../lib/api";
import { useLessonSpeechHighlight } from "./use-lesson-speech-highlight";

const playbackRates = [1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function LessonSpeech({ activityId }: { activityId: string }): JSX.Element {
  const { moduleId = "", nodeId = "" } = useParams();
  const { getToken } = useAuth();
  const [speech, setSpeech] = useState<SpeechAsset | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);
  const [activityCenter, setActivityCenter] = useState<number | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const refreshedUrl = useRef<string | null>(null);
  const readyUrl = speech?.status === "ready" ? speech.url : null;
  const showPlayer = visible && Boolean(readyUrl);
  useLessonSpeechHighlight(anchorRef, showPlayer ? speech?.timeline : null, currentTime, ended);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const update = () => {
      const bounds = anchor.getBoundingClientRect();
      setActivityCenter(bounds.left + bounds.width / 2);
    };
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    const scrollPane = anchor.closest(".node-player-scroll");
    if (scrollPane) observer.observe(scrollPane);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (speech?.status !== "queued" && speech?.status !== "processing") return;
    let active = true;
    const timer = setInterval(() => {
      void getLessonSpeech(getToken, moduleId, nodeId, activityId)
        .then((result) => {
          if (active) {
            setSpeech(result);
            setError(false);
          }
        })
        .catch(() => {
          if (active) setError(true);
        });
    }, 2_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [speech?.status, getToken, moduleId, nodeId, activityId]);

  useEffect(() => {
    if (readyUrl) setVisible(true);
  }, [readyUrl]);

  useEffect(() => {
    if (!visible || !readyUrl || !playRequested || !audioRef.current) return;
    const audio = audioRef.current;
    if (audio.ended || (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration))
      audio.currentTime = 0;
    void audio.play().catch(() => setPlayRequested(false));
  }, [visible, readyUrl, playRequested]);

  function request(): void {
    setRequesting(true);
    setError(false);
    setPlayRequested(true);
    void requestLessonSpeech(getToken, moduleId, nodeId, activityId)
      .then(setSpeech)
      .catch(() => {
        setError(true);
        setPlayRequested(false);
      })
      .finally(() => setRequesting(false));
  }

  function togglePlayback(): void {
    if (error && readyUrl) {
      request();
      return;
    }
    if (!readyUrl) {
      request();
      return;
    }
    if (playing) {
      audioRef.current?.pause();
      setPlayRequested(false);
      return;
    }
    setVisible(true);
    setPlayRequested(true);
  }

  function closePlayer(): void {
    audioRef.current?.pause();
    setPlaying(false);
    setPlayRequested(false);
    setVisible(false);
    setEnded(false);
  }

  const preparing = requesting || speech?.status === "queued" || speech?.status === "processing";
  let buttonLabel = "Dengarkan";
  if (preparing) buttonLabel = "Menyiapkan audio…";
  else if (playing) buttonLabel = "Sedang mendengarkan";
  else if (error || speech?.status === "failed") buttonLabel = "Coba lagi";

  return (
    <div ref={anchorRef} className="mb-4 space-y-2">
      <button
        type="button"
        aria-pressed={playing}
        disabled={preparing}
        onClick={togglePlayback}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold normal-case transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 ${playing ? "border-secondary-foreground bg-secondary-foreground text-background hover:opacity-90" : "border-secondary-foreground/70 bg-secondary text-secondary-foreground hover:bg-accent"}`}
      >
        <HugeiconsIcon icon={VolumeHighIcon} size={18} strokeWidth={1.5} aria-hidden="true" />
        {buttonLabel}
      </button>
      {error || speech?.status === "failed" ? (
        <p className="text-sm text-destructive" role="alert">
          {preparing
            ? "Belum dapat memeriksa audio. Mencoba lagi…"
            : "Audio belum tersedia. Coba lagi."}
        </p>
      ) : null}
      {showPlayer ? <span data-lesson-audio-open hidden /> : null}
      {showPlayer && readyUrl && activityCenter !== null
        ? createPortal(
            <div
              className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 w-[min(27rem,calc(100vw-1.5rem))] -translate-x-1/2"
              style={{ left: activityCenter }}
            >
              <section
                className="pointer-events-auto flex w-full items-center gap-2 rounded-full border border-foreground bg-card p-1.5 text-card-foreground shadow-lg sm:p-2"
                aria-label="Pemutar audio lesson"
              >
                {/* biome-ignore lint/a11y/useMediaCaption: The narrated lesson text remains visible on this page. */}
                <audio
                  ref={audioRef}
                  src={readyUrl}
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    setDuration(event.currentTarget.duration);
                    event.currentTarget.playbackRate = playbackRates[rateIndex];
                  }}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                  onSeeked={(event) => {
                    setCurrentTime(event.currentTarget.currentTime);
                    setEnded(false);
                  }}
                  onPlay={() => {
                    setPlaying(true);
                    setEnded(false);
                  }}
                  onPause={() => setPlaying(false)}
                  onEnded={() => {
                    setPlaying(false);
                    setPlayRequested(false);
                    setEnded(true);
                  }}
                  onError={() => {
                    setPlaying(false);
                    if (refreshedUrl.current === readyUrl) {
                      setError(true);
                      return;
                    }
                    refreshedUrl.current = readyUrl;
                    void requestLessonSpeech(getToken, moduleId, nodeId, activityId)
                      .then((result) => {
                        setSpeech(result);
                        setError(false);
                      })
                      .catch(() => setError(true));
                  }}
                />
                <button
                  type="button"
                  aria-label={playing ? "Jeda audio" : "Putar audio"}
                  onClick={togglePlayback}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-10"
                >
                  <HugeiconsIcon
                    icon={playing ? PauseIcon : PlayIcon}
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 px-0.5">
                  <input
                    type="range"
                    min={0}
                    max={Number.isFinite(duration) ? duration : 0}
                    step={0.1}
                    value={Math.min(currentTime, Number.isFinite(duration) ? duration : 0)}
                    onChange={(event) => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = Number(event.target.value);
                        setCurrentTime(audioRef.current.currentTime);
                        setEnded(false);
                      }
                    }}
                    aria-label="Posisi audio"
                    className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-card [&::-webkit-slider-thumb]:bg-foreground [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:bg-foreground"
                    style={{
                      background: `linear-gradient(to right, var(--foreground) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, var(--border) 0%)`,
                    }}
                  />
                  <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:inline">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Kecepatan ${playbackRates[rateIndex]} kali. Ubah kecepatan.`}
                  onClick={() => {
                    const next = (rateIndex + 1) % playbackRates.length;
                    setRateIndex(next);
                    if (audioRef.current) audioRef.current.playbackRate = playbackRates[next];
                  }}
                  className="shrink-0 rounded-full bg-muted px-2.5 py-1.5 text-xs font-semibold tabular-nums text-foreground hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {playbackRates[rateIndex].toFixed(playbackRates[rateIndex] === 1.25 ? 2 : 1)}×
                </button>
                <button
                  type="button"
                  aria-label="Tutup pemutar audio"
                  onClick={closePlayer}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-8"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={18}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </button>
              </section>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
