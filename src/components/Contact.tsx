import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { profile } from "../data/content";
import { Section } from "./Section";

const schema = z.object({
  name: z.string().trim().min(2, "Please tell me your name.").max(80, "Please use a shorter name."),
  email: z.string().trim().email("Enter a valid email so I can reply.").max(254, "Please use a shorter email address."),
  message: z.string().trim().min(10, "A few more words please, at least 10 characters.").max(5000, "Please keep your message under 5,000 characters."),
  website: z.string().optional(),
});
type Values = z.infer<typeof schema>;

const field =
  "w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-base outline-none transition focus:border-accent aria-[invalid=true]:border-red-400";

export default function Contact() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || (result as { message?: string }).message !== "Message sent.") {
        throw new Error(`Contact request failed: ${response.status}`);
      }
      toast.success("Message sent", { description: "Thanks for reaching out. I'll reply by email." });
      reset();
    } catch {
      toast.error("Couldn't send your message", { description: "Please try again or use the email address on this page." });
    }
  };

  const err = (m?: string) =>
    m ? (
      <p role="alert" className="mt-1.5 text-sm text-red-400">
        {m}
      </p>
    ) : null;

  return (
    <Section id="contact" eyebrow="05 — Contact" title="Get in touch">
      <div className="grid gap-10 lg:grid-cols-2">
        <div data-reveal>
          <p className="max-w-md text-lg text-muted">
            I'm interested in AI engineering, agent systems, and machine learning opportunities. Always open to interesting technical problems, collaborations, and conversations.
          </p>
          <dl className="mt-8 space-y-4">
            <div>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted">Email</dt>
              <dd>
                <a className="hover:text-accent" href={`mailto:${profile.email}`}>
                  {profile.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted">Phone</dt>
              <dd>
                <a className="hover:text-accent" href={`tel:${profile.phone.replace(/\s/g, "")}`}>
                  {profile.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted">Location</dt>
              <dd>{profile.location}</dd>
            </div>
          </dl>
        </div>

        <form data-reveal onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="absolute left-[-9999px]" aria-hidden="true">
            <label htmlFor="c-website">Leave this field empty</label>
            <input id="c-website" tabIndex={-1} autoComplete="off" {...register("website")} />
          </div>
          <div>
            <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium">
              Name
            </label>
            <input id="c-name" autoComplete="name" aria-invalid={!!errors.name} className={field} {...register("name")} />
            {err(errors.name?.message)}
          </div>
          <div>
            <label htmlFor="c-email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input id="c-email" type="email" autoComplete="email" aria-invalid={!!errors.email} className={field} {...register("email")} />
            {err(errors.email?.message)}
          </div>
          <div>
            <label htmlFor="c-message" className="mb-1.5 block text-sm font-medium">
              Message
            </label>
            <textarea id="c-message" rows={5} aria-invalid={!!errors.message} className={`${field} resize-y`} {...register("message")} />
            {err(errors.message?.message)}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            <Send size={15} aria-hidden /> {isSubmitting ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
    </Section>
  );
}
