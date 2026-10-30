"""A reproducible retrieval investigation for the article's fictional policies.

Run `python rag_investigation.py` to see four searches and the evidence each
would pass to a model. This deliberately stops before generation: a retrieved
passage alone does not prove what a language model would answer.
"""

from __future__ import annotations

from dataclasses import dataclass

from first_rag import terms


@dataclass(frozen=True)
class Policy:
    source: str
    text: str
    current: bool


POLICIES = (
    Policy("billing/refunds-2024.md", "Annual plans can be refunded within 60 days of purchase.", False),
    Policy("billing/refunds.md", "Annual plans can be refunded within 30 days of purchase.", True),
    Policy("billing/monthly.md", "Monthly plans may be cancelled any time but are not refunded.", True),
)

DIRECT = "Can I get a refund on my yearly plan after 45 days?"
PARAPHRASE = "Will they return the payment for my year-long subscription after six weeks?"
UNKNOWN = "Do you support Kubernetes deployments?"


def rewrite(question: str) -> str:
    """Three transparent example rules, not a general semantic retriever."""
    return (question.lower()
            .replace("return the payment", "refund")
            .replace("year-long", "annual")
            .replace("six weeks", "42 days"))


def rank(question: str, *, current_only: bool, rewrite_question: bool = False):
    searched = rewrite(question) if rewrite_question else question
    candidates = [policy for policy in POLICIES if policy.current or not current_only]
    query_terms = terms(searched)
    ranked = sorted(
        ((len(query_terms & terms(policy.text)), policy) for policy in candidates),
        key=lambda row: row[0],
        reverse=True,
    )
    return searched, ranked


def trace(name: str, question: str, *, current_only: bool, rewrite_question: bool = False) -> str:
    searched, ranked = rank(question, current_only=current_only, rewrite_question=rewrite_question)
    lines = [name.upper(), f"QUESTION: {question}"]
    if searched != question:
        lines.append(f"SEARCHED AS: {searched}")
    lines.append("CANDIDATES (word overlap):")
    lines.extend(f"  {score}  {policy.source} {'[archived]' if not policy.current else '[current]'}"
                 for score, policy in ranked)
    score, policy = ranked[0]
    if score < 2:
        lines.append("EVIDENCE SELECTED FOR PROMPT: none; search did not find a reliable match")
    else:
        lines.append(f"EVIDENCE SELECTED FOR PROMPT: [1] {policy.source}: {policy.text}")
    return "\n".join(lines)


def main() -> None:
    cases = (
        ("1. No freshness filter", DIRECT, False, False),
        ("2. Filter archived policies", DIRECT, True, False),
        ("3. Same intent, different words", PARAPHRASE, True, False),
        ("4. Rewrite the search query", PARAPHRASE, True, True),
        ("5. No relevant source", UNKNOWN, True, False),
    )
    print("\n\n".join(trace(name, question, current_only=current, rewrite_question=rewritten)
                       for name, question, current, rewritten in cases))


if __name__ == "__main__":
    main()
