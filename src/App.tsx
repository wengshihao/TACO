import { useEffect } from "react";
import { Playground } from "./components/Playground";
import { Benchmark, Cite, Footer, Hero, Method, Nav, SectionHead, Study } from "./components/Sections";

export function App() {
  useEffect(() => {
    // The browser tries to jump to the hash before React has rendered the target.
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <section className="section wide" id="playground">
          <SectionHead index="01" title="Playground">
            Paste a coding question and an LLM's answer, or load a human-labelled example. TACO runs entirely in your browser against any
            OpenAI-compatible endpoint.
          </SectionHead>
          <Playground />
        </section>
        <Method />
        <Study />
        <Benchmark />
        <Cite />
      </main>
      <Footer />
    </>
  );
}
