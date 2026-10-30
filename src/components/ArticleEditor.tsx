import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, Pencil, Send } from "lucide-react";
import { addArticle } from "../lib/articles";
import { Markdown } from "../lib/markdown";
import { Modal } from "./Modal";

const schema = z.object({
  title: z.string().trim().min(3, "Give it a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
  summary: z.string().trim().min(10, "Write a short summary, at least 10 characters.").max(220, "Keep the summary under 220 characters."),
  tags: z.string().max(100, "Too many tags."),
  body: z.string().trim().min(50, "The article needs at least 50 characters."),
});
type Values = z.infer<typeof schema>;

const DRAFT_KEY = "article-draft-v1";
const EMPTY: Values = { title: "", summary: "", tags: "", body: "" };

function loadDraft(): Values {
  try {
    return { ...EMPTY, ...(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<Values>) };
  } catch {
    return EMPTY;
  }
}

const field =
  "w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-base outline-none transition focus:border-accent aria-[invalid=true]:border-red-400";

export function ArticleEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [preview, setPreview] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: loadDraft() });

  // Keep the draft so a reload or accidental close never loses the writing.
  const values = watch();
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    } catch {
      /* ignore */
    }
  }, [values]);

  const onSubmit = (v: Values) => {
    const tags = v.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);
    addArticle({ title: v.title, summary: v.summary, body: v.body, tags });
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    reset(EMPTY);
    setPreview(false);
    onOpenChange(false);
    toast.success("Article published", { description: "It now appears in the Writing section." });
  };

  const err = (msg?: string) =>
    msg ? (
      <p role="alert" className="mt-1.5 text-sm text-red-400">
        {msg}
      </p>
    ) : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Write an article"
      description="Markdown supported: headings, lists, links, code. Your draft saves automatically."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="a-title" className="mb-1.5 block text-sm font-medium">
            Title
          </label>
          <input id="a-title" autoComplete="off" aria-invalid={!!errors.title} className={field} {...register("title")} />
          {err(errors.title?.message)}
        </div>

        <div>
          <label htmlFor="a-summary" className="mb-1.5 block text-sm font-medium">
            Summary
          </label>
          <input id="a-summary" autoComplete="off" aria-invalid={!!errors.summary} className={field} {...register("summary")} />
          {err(errors.summary?.message)}
        </div>

        <div>
          <label htmlFor="a-tags" className="mb-1.5 block text-sm font-medium">
            Tags <span className="font-normal text-muted">(comma separated, up to 5)</span>
          </label>
          <input id="a-tags" autoComplete="off" placeholder="agents, python, rag" aria-invalid={!!errors.tags} className={field} {...register("tags")} />
          {err(errors.tags?.message)}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="a-body" className="text-sm font-medium">
              Article
            </label>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted transition hover:text-fg"
            >
              {preview ? <Pencil size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <div className="min-h-[16rem] rounded-lg border border-border bg-bg p-4">
              {values.body.trim() ? <Markdown source={values.body} /> : <p className="text-muted">Nothing to preview yet.</p>}
            </div>
          ) : (
            <textarea
              id="a-body"
              rows={12}
              aria-invalid={!!errors.body}
              className={`${field} resize-y font-mono text-sm`}
              {...register("body")}
            />
          )}
          {err(errors.body?.message)}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-lg border border-border px-5 text-sm font-medium transition hover:bg-surface-2"
          >
            Close
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-accent-ink transition hover:opacity-90"
          >
            <Send size={15} aria-hidden /> Publish
          </button>
        </div>
      </form>
    </Modal>
  );
}
