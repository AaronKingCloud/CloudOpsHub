import { useState } from "react";

interface CopyButtonProps {
  text: string;
  label?: string;
}

// Copies text to the clipboard. If the browser refuses, selects the text so it can be copied by hand.
function CopyButton({ text, label = "Copy" }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  };

  return (
    <button type="button" className="btn" onClick={copy} aria-live="polite">
      {state === "copied" ? "Copied" : state === "failed" ? "Select and copy it" : label}
    </button>
  );
}

export default CopyButton;
