import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { accounts } from "../mock/accounts";
import AccountDetailModal from "./AccountDetailModal";
import Modal from "./Modal";

function Example({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Modal label="Example" onClose={close}>
          <input type="checkbox" aria-label="Check" />
          <input aria-label="Name" />
        </Modal>
      )}
    </>
  );
}

async function openExample(onClose?: () => void) {
  render(<Example onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "Open" }));
  return screen.getByRole("dialog", { name: "Example" });
}

describe("Modal", () => {
  it("opens as a modal dialog with focus on the first text field", async () => {
    const dialog = await openExample();
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });

  it("starts on the element marked data-autofocus instead, when there is one", () => {
    render(
      <Modal label="Confirm" role="alertdialog" onClose={() => {}}>
        <input aria-label="Name" />
        <button type="button" data-autofocus>
          Keep
        </button>
      </Modal>,
    );
    expect(screen.getByRole("alertdialog", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep" })).toHaveFocus();
  });

  it("closes on a click outside the panel, but not inside it", async () => {
    const onClose = vi.fn();
    const dialog = await openExample(onClose);
    await userEvent.click(screen.getByRole("textbox", { name: "Name" }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with Escape and with the browser's own cancel", async () => {
    await openExample();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names the cloud account pop-up after the account and closes from its button", async () => {
    const onClose = vi.fn();
    render(<AccountDetailModal account={accounts[0]} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: accounts[0].accountName })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
