const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const hoverCapable = matchMedia("(hover: hover) and (pointer: fine)");
const syncPreviews = new EventTarget();
const formatTime = (time: number): string => {
  const seconds = Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

document.querySelectorAll<HTMLElement>("[data-feature-player]").forEach((root) => {
  const get = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing video player element: ${selector}`);
    return element;
  };
  const preview = get<HTMLVideoElement>("[data-preview]");
  const trigger = get<HTMLButtonElement>("[data-video-trigger]");
  const dialog = get<HTMLDialogElement>("dialog");
  const content = get<HTMLElement>("[data-video-content]");
  const video = get<HTMLVideoElement>("[data-modal-video]");
  const play = get<HTMLButtonElement>("[data-play]");
  const playIcon = get<SVGPathElement>("[data-play-icon]");
  const seek = get<HTMLInputElement>("[data-seek]");
  const fullscreen = get<HTMLButtonElement>("[data-fullscreen]");
  const time = get<HTMLElement>("[data-time]");
  const status = get<HTMLElement>("[data-status]");
  let visible = false;
  let hovering = false;
  let previousOverflow = "";
  let wasPlaying = false;
  preview.muted = true;
  video.muted = true;

  const canPreview = () =>
    visible &&
    !hovering &&
    !trigger.matches(":focus-visible") &&
    !document.hidden &&
    !reducedMotion.matches &&
    !document.querySelector("[data-video-dialog][open]");
  const syncPreview = () => {
    if (canPreview()) {
      void preview
        .play()
        .then(() => {
          if (!canPreview()) preview.pause();
        })
        .catch(() => {
          // Autoplay may be blocked; the poster and demo button remain available.
        });
    } else preview.pause();
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      syncPreview();
    },
    { threshold: [0, 0.25] },
  );
  observer.observe(trigger);
  trigger.addEventListener("pointerenter", () => {
    hovering = hoverCapable.matches;
    syncPreview();
  });
  trigger.addEventListener("pointerleave", () => {
    hovering = false;
    syncPreview();
  });
  trigger.addEventListener("focus", syncPreview);
  trigger.addEventListener("blur", syncPreview);
  reducedMotion.addEventListener("change", syncPreview);
  syncPreviews.addEventListener("change", syncPreview);

  const showStatus = (message: string) => {
    status.textContent = message;
    status.hidden = !message;
  };
  const startVideo = () => {
    void video
      .play()
      .then(() => {
        if (!dialog.open || document.hidden) video.pause();
      })
      .catch(() => {
        if (dialog.open && !video.error) showStatus("Tekan putar untuk memulai video.");
      });
  };
  trigger.addEventListener("click", () => {
    previousOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    syncPreviews.dispatchEvent(new Event("change"));
    if (!video.hasAttribute("src")) video.src = preview.src;
    if (video.error) video.load();
    video.currentTime = 0;
    showStatus("Memuat video…");
    startVideo();
  });
  get<HTMLButtonElement>("[data-close]").addEventListener("click", () => dialog.close());
  let backdropPress = false;
  dialog.addEventListener("pointerdown", (event) => {
    backdropPress = event.target === dialog;
  });
  dialog.addEventListener("click", (event) => {
    if (backdropPress && event.target === dialog) dialog.close();
    backdropPress = false;
  });
  dialog.addEventListener("close", () => {
    video.pause();
    wasPlaying = false;
    if (document.fullscreenElement === content) {
      void document.exitFullscreen().catch(() => {
        // Closing the dialog may already have ended fullscreen.
      });
    }
    document.documentElement.style.overflow = previousOverflow;
    hovering = hoverCapable.matches && trigger.matches(":hover");
    trigger.focus({ preventScroll: true });
    syncPreviews.dispatchEvent(new Event("change"));
  });
  const togglePlayback = () => {
    if (video.paused) startVideo();
    else video.pause();
  };
  play.addEventListener("click", togglePlayback);
  video.addEventListener("click", togglePlayback);
  const updatePlayback = () => {
    play.setAttribute("aria-label", video.paused ? "Putar video" : "Jeda video");
    playIcon.setAttribute("d", video.paused ? "M8 5v14l11-7z" : "M6 5h4v14H6zM14 5h4v14h-4z");
  };
  video.addEventListener("play", updatePlayback);
  video.addEventListener("pause", updatePlayback);
  video.addEventListener("playing", () => showStatus(""));
  video.addEventListener("waiting", () => showStatus("Memuat video…"));
  video.addEventListener("error", () =>
    showStatus("Video belum bisa dimuat. Tutup lalu coba lagi."),
  );
  const updateTime = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    seek.max = String(duration);
    seek.disabled = !duration;
    seek.value = String(video.currentTime);
    seek.setAttribute(
      "aria-valuetext",
      `${formatTime(video.currentTime)} dari ${formatTime(duration)}`,
    );
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
  };
  video.addEventListener("loadedmetadata", updateTime);
  video.addEventListener("timeupdate", updateTime);
  seek.addEventListener("input", () => {
    video.currentTime = Number(seek.value);
  });
  const iosVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
  fullscreen.hidden = !document.fullscreenEnabled && !iosVideo.webkitEnterFullscreen;
  fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await content.requestFullscreen();
      else iosVideo.webkitEnterFullscreen?.();
    } catch {
      showStatus("Layar penuh tidak tersedia di browser ini.");
    }
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreen.setAttribute(
      "aria-label",
      document.fullscreenElement === content ? "Keluar layar penuh" : "Layar penuh",
    );
  });
  document.addEventListener("visibilitychange", () => {
    syncPreview();
    if (document.hidden) {
      wasPlaying = dialog.open && !video.paused;
      video.pause();
    } else if (dialog.open && wasPlaying) {
      wasPlaying = false;
      startVideo();
    }
  });
});
