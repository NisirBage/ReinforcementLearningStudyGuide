// The renderer as the app loads it: the KaTeX stylesheet travels with this chunk, so only maths pages load it.
// The functions live in renderCore.ts, which Node tools (the validator) import without the stylesheet.
import "katex/dist/katex.min.css"; // travels with the renderer chunk, so only maths pages load it
export * from "./renderCore";
