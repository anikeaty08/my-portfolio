import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { unlockOwner } from "../lib/owner";
import { Modal } from "./Modal";

export function OwnerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await unlockOwner(value);
    setBusy(false);
    if (ok) {
      setValue("");
      setError("");
      onOpenChange(false);
      toast.success("Owner mode on", { description: "You can now write articles." });
    } else {
      setError("That passphrase isn't right. Try again.");
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Owner sign-in" description="Only the site owner can write articles.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="owner-pass" className="mb-1.5 block text-sm font-medium">
            Passphrase
          </label>
          <input
            id="owner-pass"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!!error}
            className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-base outline-none focus:border-accent aria-[invalid=true]:border-red-400"
          />
          {error && (
            <p role="alert" className="mt-1.5 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="h-11 w-full rounded-lg bg-brand text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </Modal>
  );
}
