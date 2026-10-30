import sys, numpy as np, torch
from transformers import AutoModel, AutoTokenizer
sys.stdout.reconfigure(encoding="utf-8")
TEXT = ("Berlin is the capital and largest city of Germany, both by area and by population. "
        "Its more than 3.85 million inhabitants make it the European Union's most populous city, as measured by population within city limits. "
        "The city is also one of the states of Germany, and is the third smallest state in the country in terms of area.")
def spans_of(text):
    import re
    out, pos = [], 0
    for m in re.finditer(r"(?<=[.!?])\s+", text):
        out.append((pos, m.start())); pos = m.end()
    out.append((pos, len(text))); return out
def run(name, **kw):
    tok = AutoTokenizer.from_pretrained(name, **kw); model = AutoModel.from_pretrained(name, **kw).eval()
    def pooled(text, spans):
        enc = tok(text, return_tensors="pt", return_offsets_mapping=True, truncation=True, max_length=512)
        offs = enc.pop("offset_mapping")[0].tolist()
        with torch.no_grad(): h = model(**enc).last_hidden_state[0]
        vs = []
        for s, e in spans:
            idx = [i for i, (a, b) in enumerate(offs) if b > a and s <= (a + b) / 2 < e]
            v = h[idx].mean(0); vs.append(torch.nn.functional.normalize(v, dim=0))
        return torch.stack(vs)
    sp = spans_of(TEXT)
    late = pooled(TEXT, sp)
    naive = torch.cat([pooled(TEXT[s:e], [(0, e - s)]) for s, e in sp])
    q = pooled("Berlin", [(0, 6)])[0]
    print(name)
    for i, (s, e) in enumerate(sp):
        print(f"  sentence {i+1}: naive {float(naive[i] @ q):.4f}  late {float(late[i] @ q):.4f}")
run(sys.argv[1])
