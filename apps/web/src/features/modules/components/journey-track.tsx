import type { JourneySummary } from "@ngertiin/contracts/api";
import { ArrowRight, ChevronUp, Play } from "lucide-react";
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
        <div className="pointer-events-none sticky bottom-[max(20px,env(safe-area-inset-bottom))] z-10 flex h-0 items-end justify-center md:bottom-6 [&>*]:pointer-events-auto">
          {activeVisible ? (
            <section
              className="relative isolate flex w-full max-w-lg items-center gap-3 rounded-2xl border border-primary/30 bg-card px-3 py-2.5 shadow-[0_8px_28px_color-mix(in_srgb,var(--primary)_18%,transparent)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-180"
              aria-label="Belajar berikutnya"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-primary/5"
              />
              <span
                aria-hidden="true"
                className="relative grid size-9 shrink-0 -rotate-6 place-items-center rounded-xl border border-primary/20 bg-accent text-link shadow-[0_2px_0_var(--primary-edge)]"
              >
                <Play className="ml-0.5 size-4 fill-current" />
              </span>
              <p
                className="min-w-0 flex-1 line-clamp-2 text-sm font-bold leading-5"
                title={activeNode.title}
              >
                {activeNode.title}
              </p>
              <Button
                asChild
                className="h-9 shrink-0 rounded-full px-3 text-xs normal-case shadow-none [&_svg]:size-3.5"
                size="sm"
              >
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
