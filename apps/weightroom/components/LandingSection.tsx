"use client";

import { useEffect, useRef } from "react";

export function LandingSection(props: React.ComponentProps<"section">) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(function observeSectionEntry() {
    const section = sectionRef.current;
    if (!section || !window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      function revealSection(entries) {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "true");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.08 },
    );

    observer.observe(section);
    return function disconnectObserver() {
      observer.disconnect();
    };
  }, []);

  return <section {...props} ref={sectionRef} />;
}
