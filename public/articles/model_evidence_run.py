"""Run the article's evidence tests with a small local language model."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from rag_investigation import DIRECT, POLICIES


MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
GRAPH_NOTES_SOURCE = "Graph RAG notes — Costs and honest limits"
GRAPH_NOTES_EXCERPT = (
    "Building a graph from text costs many LLM calls; large corpora can be expensive.\n"
    "Extraction makes mistakes (missed links, wrong merges), and a wrong edge can mislead confidently.\n"
    "A graph needs maintenance as source documents change.\n"
    "For purely single-passage questions, a graph adds cost without improving answers."
)


def prompt(question: str, source: str, evidence: str) -> str:
    return (
        "Answer using only the source below. If it does not establish the answer, "
        "say you cannot determine it from the source. Cite [1] in factual answers.\n\n"
        f"[1] {source}\n{evidence}\n\nQuestion: {question}"
    )


def generate(model, tokenizer, question: str, source: str, evidence: str) -> tuple[str, float]:
    messages = [
        {"role": "system", "content": "You are a careful assistant. Follow the user's source-only instruction."},
        {"role": "user", "content": prompt(question, source, evidence)},
    ]
    encoded = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=True,
                                            return_tensors="pt")
    input_ids = encoded if isinstance(encoded, torch.Tensor) else encoded["input_ids"]
    attention_mask = None if isinstance(encoded, torch.Tensor) else encoded["attention_mask"]
    started = time.perf_counter()
    with torch.inference_mode():
        output = model.generate(input_ids, attention_mask=attention_mask,
                                max_new_tokens=110, do_sample=False,
                                pad_token_id=tokenizer.eos_token_id)
    elapsed = time.perf_counter() - started
    return tokenizer.decode(output[0][input_ids.shape[1]:], skip_special_tokens=True).strip(), elapsed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--output", type=Path, help="save the exact trace to a text file")
    args = parser.parse_args()
    torch.set_num_threads(4)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.float32)
    model.eval()

    archived, current = POLICIES[:2]
    cases = (
        ("ARCHIVED POLICY", DIRECT, archived.source, archived.text),
        ("CURRENT POLICY", DIRECT, current.source, current.text),
        ("REAL SOURCE PASSAGE", "Why is Graph RAG a poor fit for a simple refund-policy lookup?",
         GRAPH_NOTES_SOURCE, GRAPH_NOTES_EXCERPT),
        ("SOURCE HAS NO ANSWER", "Who approved the company's Graph RAG rollout?",
         GRAPH_NOTES_SOURCE, GRAPH_NOTES_EXCERPT),
    )
    blocks = [f"MODEL: {args.model}\nGENERATION: greedy, max 110 new tokens"]
    for label, question, source, evidence in cases:
        answer, elapsed = generate(model, tokenizer, question, source, evidence)
        blocks.append(f"{label}\nQUESTION: {question}\nSOURCE [1]: {source}\n"
                      f"EVIDENCE: {evidence}\nMODEL ANSWER: {answer}\nELAPSED: {elapsed:.2f}s")
    report = "\n\n".join(blocks) + "\n"
    print(report)
    if args.output:
        args.output.write_text(report, encoding="utf-8")


if __name__ == "__main__":
    main()
