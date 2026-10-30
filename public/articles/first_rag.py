"""A small first RAG: retrieve a source, then optionally ask a local model.

Run `python first_rag.py` to inspect retrieval without installing packages.
Run `python first_rag.py --generate` after starting Ollama and pulling gemma3:1b.
"""

from __future__ import annotations

import argparse
import json
import re
from urllib.error import URLError
from urllib.request import Request, urlopen


DOCUMENTS = [
    ("billing/refunds.md", "Annual plans can be refunded within 30 days of purchase."),
    ("billing/monthly.md", "Monthly plans may be cancelled any time but are not refunded."),
    ("support/hours.md", "Support is available Monday to Friday, 9am to 6pm IST."),
]

ALIASES = {"yearly": "annual", "subscription": "plan", "plans": "plan",
           "refunded": "refund", "refunds": "refund", "days": "day"}
STOP_WORDS = {"a", "after", "at", "be", "can", "do", "get", "i", "is", "my",
              "of", "on", "the", "to", "within", "you"}


def terms(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {ALIASES.get(word, word) for word in words if word not in STOP_WORDS}


def search(question: str) -> list[tuple[int, str, str]]:
    query = terms(question)
    ranked = [(len(query & terms(body)), source, body) for source, body in DOCUMENTS]
    return sorted(ranked, key=lambda row: row[0], reverse=True)


def build_prompt(question: str, source: str, body: str) -> str:
    return (
        "Answer only from the source below. If it does not answer the question, "
        "say you cannot verify it. Cite the source as [1].\n\n"
        f"[1] {source}\n{body}\n\nQuestion: {question}\nAnswer:"
    )


def ask_ollama(prompt: str, model: str) -> str:
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False,
                          "options": {"temperature": 0}}).encode("utf-8")
    request = Request("http://127.0.0.1:11434/api/generate", data=payload,
                      headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=90) as response:
        result = json.load(response)
    return result["response"].strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="See one question move through a tiny RAG")
    parser.add_argument("--question", default="Can I get a refund on my yearly plan after 45 days?")
    parser.add_argument("--generate", action="store_true", help="ask a local Ollama model")
    parser.add_argument("--model", default="gemma3:1b")
    args = parser.parse_args()

    print(f"QUESTION: {args.question}\n")
    ranked = search(args.question)
    print("CANDIDATES (word overlap; higher is better):")
    for score, source, _ in ranked:
        print(f"  {score}  {source}")

    score, source, body = ranked[0]
    if score < 2:
        print("\nANSWER: I could not find a source that answers this question.")
        return

    print(f"\nSELECTED [1] {source}: {body}")
    prompt = build_prompt(args.question, source, body)
    if not args.generate:
        print(f"\nPROMPT PREVIEW:\n{prompt}")
        print("\nRun with --generate to send this evidence to a local model.")
        return

    try:
        answer = ask_ollama(prompt, args.model)
    except (URLError, TimeoutError) as error:
        raise SystemExit(f"Cannot reach Ollama: {error}. Start it and pull {args.model}.") from error
    print(f"\nMODEL ANSWER: {answer}")
    print(f"SOURCE [1]: {source}")
    if "[1]" not in answer:
        print("CHECK: The model did not cite [1]; verify its answer before using it.")


if __name__ == "__main__":
    main()
