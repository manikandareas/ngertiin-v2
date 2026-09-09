// Presentation bands describe this attempt, independently of accumulated concept mastery.
export function getAttemptPresentation(normalizedScore: number) {
  if (normalizedScore >= 0.8) {
    return {
      tone: "success",
      title: "Keren, makin paham!",
      description: "Usahamu terlihat. Sebagian besar jawabanmu sudah tepat.",
      label: "Langkah yang bagus.",
    } as const;
  }
  if (normalizedScore >= 0.5) {
    return {
      tone: "warning",
      title: "Sudah di jalur yang tepat.",
      description: "Ada yang sudah kuat, ada yang bisa kita latih sedikit lagi.",
      label: "Sedikit lagi, makin mantap.",
    } as const;
  }
  return {
    tone: "attention",
    title: "Kita kuatkan pelan-pelan, ya.",
    description: "Hasil ini adalah titik awal. Kita bisa mulai dari bagian yang paling sederhana.",
    label: "Setiap langkah berarti.",
  } as const;
}

export type AttemptTone = ReturnType<typeof getAttemptPresentation>["tone"];
