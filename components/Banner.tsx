type BannerProps = {
  art: string;
  label: string; // real text for screen readers
  tone?: "terminal" | "alert";
};

// Renders a FIGlet banner from lib/ascii.ts. The <pre> block is aria-hidden
// so screen readers never read hundreds of box-drawing characters — a
// visually-hidden heading carries the real text instead.
export default function Banner({ art, label, tone = "terminal" }: BannerProps) {
  return (
    <div>
      <h1 className="sr-only">{label}</h1>
      <pre
        aria-hidden="true"
        className={`ascii-banner ${tone === "alert" ? "ascii-banner--alert" : ""}`}
      >
        {art}
      </pre>
    </div>
  );
}
