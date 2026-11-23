import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  className?: string; // extra classes for the panel
  label?: string; // accessible name when there is no visible title…
  labelledBy?: string; // …or the id of the title
  describedBy?: string;
  role?: "alertdialog"; // for confirmations; a plain dialog otherwise
}

// Every pop-up uses this. It's a native <dialog>, so the browser keeps keyboard focus inside it, hides the page
// behind from screen readers, and gives focus back to the button that opened it. Esc or a click outside closes it.
// Focus starts on the element marked data-autofocus, or else on the first text field.
function Modal({ onClose, children, className = "", label, labelledBy, describedBy, role }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // A layout effect, so closing happens while the dialog is still on the page and focus can be returned.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const first =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.querySelector<HTMLElement>("input:not([type=radio]):not([type=checkbox]):not(:disabled)");
    first?.focus();
    return () => dialog.close();
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // The dialog covers the whole screen and the panel sits inside it, so a click on the dialog itself is "outside".
    const onClick = (e: MouseEvent) => {
      if (e.target === dialog) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // "cancel" covers the other ways to dismiss (e.g. Android's back gesture). React removes the dialog itself.
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("cancel", onCancel);
    window.addEventListener("keydown", onKey);
    return () => {
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("cancel", onCancel);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className="modal-overlay"
      role={role}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <div className={`modal-dialog ${className}`.trim()}>{children}</div>
    </dialog>
  );
}

export default Modal;
