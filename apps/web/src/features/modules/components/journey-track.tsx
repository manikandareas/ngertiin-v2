import type { JourneySummary } from "@ngertiin/contracts/api";
import { ArrowRight, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { nextLearningRoute } from "../next-learning-route";
import { JourneyNodeItem } from "./journey-node-item";

export function JourneyTrack({ data, canLearn }: { data: JourneySummary; canLearn: boolean }) {
  const destination = nextLearningRoute(data.nextAction);
  const activeNodeRef = useRef<HTMLLIElement>(null);
  const [activeVisible, setActiveVisible] = useState(false);
  const action = data.nextAction;
  const activeNodeId = action && "nodeId" in action ? action.nodeId : null;

  useEffect(() => {
    setActiveVisible(false);
    if (!activeNodeId) return;
    const target = activeNodeRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActiveVisible(entry?.isIntersecting ?? false),
      { rootMargin: "-24px 0px -220px 0px", threshold: 0.25 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeNodeId]);

  const activeNode = data.nodes.find((node) => node.id === activeNodeId);

  const resume =
    data.nextAction.type === "resume_core_node" || data.nextAction.type === "resume_adaptive_node";
  const returnToActive = () => {
    activeNodeRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
    activeNodeRef.current?.querySelector("a")?.focus({ preventScroll: true });
  };

  return (
    <section className="relative min-w-0" aria-label="Alur belajar">
      <ol className="pt-16 pb-60 md:pt-18">
        {data.nodes.map((node, index) => (
          <JourneyNodeItem
            key={node.id}
            node={node}
            index={index}
            moduleId={data.module.id}
            current={node.id === activeNodeId && canLearn}
            ref={node.id === activeNodeId ? activeNodeRef : undefined}
          />
        ))}
      </ol>
      {data.nodes.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Belum ada node belajar di modul ini.
        </p>
      ) : null}
      {activeNode && destination && canLearn ? (
        <div className="pointer-events-none sticky bottom-[max(20px,env(safe-area-inset-bottom))] z-10 flex h-0 items-end md:bottom-6 [&>*]:pointer-events-auto">
          {activeVisible ? (
            <section
              className="w-full rounded-[28px] border-2 border-input bg-card px-4 py-5 shadow-[0_18px_60px_color-mix(in_srgb,var(--primary)_18%,transparent)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-180 md:rounded-[36px] md:px-5 md:pt-7 md:pb-6"
              aria-label="Belajar berikutnya"
            >
              <p className="mb-5 text-center text-xl font-extrabold">{activeNode.title}</p>
              <Button asChild className="w-full rounded-full" size="lg">
                <Link to={destination}>
                  {resume ? "Lanjutkan" : "Mulai"}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </section>
          ) : (
            <Button
              onClick={returnToActive}
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="Kembali ke node belajar saat ini"
            >
              <ChevronUp aria-hidden="true" />
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}
