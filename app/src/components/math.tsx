// Components that render maths and Markdown (KaTeX + markdown-it). Kept apart from ui.tsx so that only the
// pages that show maths load the renderer chunk.
import { renderInline, renderMarkdown, renderTex } from "../lib/render";
import type { Flag } from "../content/schema";

export function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  return <span className={display ? "tex tex-display" : "tex"} dangerouslySetInnerHTML={{ __html: renderTex(tex, display) }} />;
}

/** Markdown with $…$ maths. Content is trusted repository text and raw HTML is disabled in the renderer. */
export function Md({ text, className }: { text: string; className?: string }) {
  return <div className={className ? `md ${className}` : "md"} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}

export function MdInline({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderInline(text) }} />;
}

const FLAG_LABEL: Record<Flag["type"], string> = {
  "suspected-typo": "Possible typo in the source",
  "source-acknowledged-issue": "Issue noted by the book itself",
  "figure-rounding": "Printed values are rounded",
  "extraction-uncertain": "Transcription uncertain",
  "empty-in-draft": "Empty in this draft",
  "notation-unverified": "2018-edition notation not verified",
  "replication-discrepancy": "Measured differently from the draft",
};

export function Flags({ flags }: { flags?: Flag[] }) {
  if (!flags?.length) return null;
  return (
    <div className="flags">
      {flags.map((f, i) => (
        <div className="flag" key={i} role="note">
          <strong>⚑ {FLAG_LABEL[f.type]}.</strong> <MdInline text={f.note} />
          {f.suggestion && (
            <>
              {" "}
              <em>Reading note:</em> <MdInline text={f.suggestion} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
