import html, re, os, json

DIR = os.path.dirname(os.path.abspath(__file__))
HERE = os.path.dirname(os.path.abspath(__file__))
BAR = '<span class="g">│</span>'

# (step, tab label, md file). Step 4 keeps its alias table here because its md
# predates the <!-- alias: ... --> convention.
STEPS = [
    (1, "Bước 1 · Gửi câu hỏi", "buoc-1-kien-truc.md"),
    (2, "Bước 2 · Chặn cổng", "buoc-2-kien-truc.md"),
    (3, "Bước 3 · Scope", "buoc-3-kien-truc.md"),
    (4, "Bước 4 · Lịch sử", "buoc-4-kien-truc.md"),
    (5, "Bước 5 · Phân loại", "buoc-5-kien-truc.md"),
    (6, "Bước 6 · Nguyên liệu", "buoc-6-kien-truc.md"),
    (7, "Bước 7 · Viết trả lời", "buoc-7-kien-truc.md"),
    (8, "Bước 8 · Soát lại", "buoc-8-kien-truc.md"),
    (9, "Bước 9 · Gửi về", "buoc-9-kien-truc.md"),
    (10, "Bước 10 · Ghi sổ", "buoc-10-kien-truc.md"),
    ("aws", "AWS · Bedrock & KMS", "aws-bedrock-kms-kien-truc.md"),
]

STEP4_ALIASES = {
    "Assistant.Api": ["Assistant.Api"],
    "ChatOrchestrator": ["ChatOrchestrator"],
    "ConversationStore": ["ConversationStore"],
    "PostgreSQL · database `assistant`": ["PostgreSQL"],
    "Bảng `conversation` và `message`": ["Bảng conversation"],
    "`conversationId`": ["conversationId"],
    "Amazon Bedrock · Claude Haiku 4.5": ["Claude Haiku 4.5", "Haiku"],
    "`ApplyGuardrail` và `guardrailConfig`": ["ApplyGuardrail", "guardrailConfig"],
    "`Task.WhenAll`": ["Task.WhenAll"],
    "Lượt (turn) và message": ["theo lượt, không theo message", "tool_call"],
    "Context window và context rot": [],
    "Sliding window (cửa sổ trượt)": ["CỬA SỔ"],
    "Compaction (tóm tắt)": ["TÓM TẮT LƯỢT CŨ", "bản tóm tắt"],
    "Bộ nhớ ngắn hạn và dài hạn": [],
    "`ConversationWindowOptions`": ["ConversationWindowOptions"],
    "AD-22": ["AD-22"],
    "Token": [],
    "Prompt caching · `cachePoint` · TTL": ["cachePoint"],
    "Chunk": ["chunk"],
    "Retention · `expires_at` · xóa cứng": ["expires_at", "retention", "xóa cứng"],
    "PII · `ApplyGuardrail` ANONYMIZE": ["ANONYMIZE", "PII"],
    "GDPR · DPO": [],
}

CARD_FIELDS = ["Là gì", "Ở kiến trúc này", "Vì sao", "Nguồn"]
SKIP_SECTIONS = ("## Từ khóa", "## Bước 4 nằm ở đâu")


# ---------------------------------------------------------------- text helpers

def highlight(flow):
    out = []
    for line in flow.split("\n"):
        s = html.escape(line, quote=False)
        s = re.sub(r"([│├┤┐┘┬┴┼─▼◀▶⇄]+)", r'<span class="g">\1</span>', s)
        # top-level step titles: "1. GỬI CÂU HỎI", "3 + 4. CHUẨN BỊ"
        s = re.sub(r"^(\d+(?: \+ \d+)?\. \S.*?)(\s{2,}\(.*\))?$",
                   lambda m: f'<span class="h">{m.group(1)}</span>'
                   + (f'<span class="n">{m.group(2)}</span>' if m.group(2) else ""), s)
        # sub-step titles: "4.1 TÌM HỘI THOẠI      Assistant.Api · ConversationStore", "6a.2 ...", "10.1 ..."
        s = re.sub(r"^(\d+[abc]?\.\d \S.*?)(\s{2,}.*)?$",
                   lambda m: f'<span class="h">{m.group(1)}</span>'
                   + (f'<span class="n">{m.group(2)}</span>' if m.group(2) else ""), s)
        s = re.sub(r"(\s)(6[abc]\. [A-ZÀ-Ỹ][^<(]*?)(\s{2,}|$)", r'\1<span class="h2">\2</span>\3', s)
        s = re.sub(r"(─</span> )(BỘ LỌC AN TOÀN SOÁT CÂU HỎI|\d\. [^<]+)", r'\1<span class="h2">\2</span>', s)
        s = re.sub(r"(─</span> )(Hỏi tài liệu|Tính toán|Tra trường hợp cũ)", r'\1<span class="br">\2</span>', s)
        s = re.sub(r"(\s)(\d[abc]?\.\d)(\s)", r'\1<span class="sn">\2</span>\3', s)
        s = s.replace("Làm gì:", '<span class="k">Làm gì:</span>')
        s = s.replace("Làm thế nào:", '<span class="k">Làm thế nào:</span>')
        s = re.sub(r"^(Kết quả:?)", r'<span class="k">\1</span>', s)
        for mark, cls in (("✗", "x"), ("⏸", "w")):
            s = re.sub(rf"({mark}[^<]*?)(\s*(?:{re.escape(BAR)}\s*)?)$",
                       rf'<span class="{cls}">\1</span>\2', s)
        out.append(s)
    body = "\n".join(out)
    assert html.unescape(re.sub(r"<[^>]+>", "", body)) == flow, "highlight changed text"
    return body


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![*\w])\*([^*]+)\*(?!\*)", r"<i>\1</i>", t)
    return t


# ---------------------------------------------------------------- step tabs

class StepTab:
    """One tab: parse keyword cards (tooltip data), render sections, wrap the first
    occurrence of each keyword with a tooltip trigger."""

    def __init__(self, step, md, alias_table=None):
        self.step, self.md = step, md
        self.cards, self.alias_to_id, self.seen = [], {}, set()
        self._collect_cards(alias_table)
        alts = sorted(self.alias_to_id, key=len, reverse=True)
        self.term_re = re.compile(r"(?<![\w.])(" + "|".join(re.escape(a) for a in alts) + r")(?![\w])") if alts else None

    def _collect_cards(self, alias_table):
        lines = self.md.split("\n")
        for i, ln in enumerate(lines):
            m = re.match(r"^\*\*(.+?)\*\*\s*$", ln)
            if not m:
                continue
            j, aliases = i + 1, None
            am = re.match(r"^<!-- alias: (.*) -->$", lines[j]) if j < len(lines) else None
            if am:
                aliases = [a.strip() for a in am.group(1).split(",") if a.strip()]
                j += 1
            if j >= len(lines) or not lines[j].startswith("- Là gì:"):
                continue
            raw = m.group(1)
            if aliases is None:
                assert alias_table is not None and raw in alias_table, f"step {self.step}: no aliases for {raw}"
                aliases = alias_table[raw]
            fields = []
            while j < len(lines) and lines[j].startswith("- "):
                k, v = lines[j][2:].split(":", 1)
                fields.append({"k": k.strip(), "v": inline(v.strip())})
                j += 1
            assert [f["k"] for f in fields] == CARD_FIELDS, f"step {self.step}: card fields wrong: {raw}"
            cid = f"s{self.step}k{len(self.cards)}"
            self.cards.append({"id": cid, "name": inline(raw), "fields": fields})
            for a in aliases:
                assert a not in self.alias_to_id, f"step {self.step}: alias used twice: {a}"
                self.alias_to_id[a] = cid

    def wrap(self, fragment):
        if not self.term_re:
            return fragment

        def sub(m):
            cid = self.alias_to_id[m.group(1)]
            if cid in self.seen:
                return m.group(1)
            self.seen.add(cid)
            return f'<span class="term" tabindex="0" data-k="{cid}">{m.group(1)}</span>'

        parts = re.split(r"(<[^>]+>)", fragment)
        for idx, p in enumerate(parts):
            if not p.startswith("<"):
                parts[idx] = self.term_re.sub(sub, p)
        return "".join(parts)

    def render(self):
        lines = self.md.split("\n")
        out, i, n = [], 0, len(lines)
        while i < n and not lines[i].startswith("## "):   # no intro text
            i += 1
        while i < n:
            ln = lines[i]
            if ln.startswith(SKIP_SECTIONS):
                i += 1
                while i < n and not lines[i].startswith("## "):
                    i += 1
                continue
            if ln.startswith("```"):
                j = i + 1
                while not lines[j].startswith("```"):
                    j += 1
                out.append(f"<pre>{self.wrap(highlight(chr(10).join(lines[i + 1:j])))}</pre>")
                i = j + 1
                continue
            if ln.startswith("## "):
                out.append(f"<h2>{inline(ln[3:])}</h2>")
                i += 1
                continue
            if ln.startswith("|"):
                rows = []
                while i < n and lines[i].startswith("|"):
                    rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                    i += 1
                body = [r for r in rows[1:] if not all(set(c) <= set("-: ") for c in r)]
                tb = "<tr>" + "".join(f"<th>{self.wrap(inline(c))}</th>" for c in rows[0]) + "</tr>"
                tb += "".join("<tr>" + "".join(f"<td>{self.wrap(inline(c))}</td>" for c in r) + "</tr>" for r in body)
                out.append(f'<div class="nt-tbl"><table class="st-tbl">{tb}</table></div>')
                continue
            if ln.startswith("- "):
                items = []
                while i < n and lines[i].startswith("- "):
                    items.append(f"<li>{self.wrap(inline(lines[i][2:]))}</li>")
                    i += 1
                out.append("<ul>" + "".join(items) + "</ul>")
                continue
            if ln.strip():
                out.append(f"<p>{self.wrap(inline(ln))}</p>")
            i += 1
        return "\n".join(out)

    def data(self):
        return {c["id"]: {"name": c["name"], "fields": c["fields"]} for c in self.cards}


# ---------------------------------------------------------------- diagrams

PAD, GAP, ROWGAP, LABEL_H, END_GAP = 18, 36, 26, 22, 12
TITLE_CW, SUB_CW, MAX_W, MIN_W = 7.6, 6.7, 250, 132
TITLE_LH, SUB_LH, PAD_Y, PAD_X = 17, 15, 11, 12


def parse_diagrams(md):
    diagrams = {}
    for m in re.finditer(r"^## (\S+)\s*\n+```diagram\n(.*?)\n```", md, re.S | re.M):
        spec = {"start": None, "rows": [], "ends": []}
        for ln in m.group(2).split("\n"):
            ln = ln.rstrip()
            if not ln:
                continue
            if ln.startswith("start:"):
                spec["start"] = parse_node(ln[6:])
            elif ln.startswith("row:"):
                spec["rows"].append({"label": ln[4:].strip(), "nodes": []})
            elif ln.startswith("- "):
                spec["rows"][-1]["nodes"].append(parse_node(ln[2:]))
            elif ln.startswith("end:"):
                spec["ends"].append(parse_node(ln[4:]))
            else:
                raise ValueError(f"diagram {m.group(1)}: bad line: {ln}")
        assert not spec["ends"] or len(spec["rows"]) == 1, "end: only allowed with one row"
        diagrams.setdefault(m.group(1).split(".")[0], []).append(spec)
    return diagrams


def wrap_words(text, max_chars):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > max_chars:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines


def parse_node(s):
    s = s.strip()
    kind = {"*": "target", "!": "stop", "?": "warn"}.get(s[:1], "")
    if kind:
        s = s[1:].strip()
    title, _, sub = (p.strip() for p in s.partition("|"))
    inner = MAX_W - 2 * PAD_X
    t_lines = wrap_words(title, int(inner / TITLE_CW))
    s_lines = wrap_words(sub, int(inner / SUB_CW)) if sub else []
    w = max([len(x) * TITLE_CW for x in t_lines] + [len(x) * SUB_CW for x in s_lines]) + 2 * PAD_X
    w = max(MIN_W, min(MAX_W, w))
    h = 2 * PAD_Y + len(t_lines) * TITLE_LH + len(s_lines) * SUB_LH + (3 if s_lines else 0)
    return {"kind": kind, "t": t_lines, "s": s_lines, "w": w, "h": h}


def svg_diagram(uid, label, spec):
    el = []  # (kind, payload) collected in layout coords, shifted at the end
    rows, start, ends = spec["rows"], spec["start"], spec["ends"]
    ncols = max(len(r["nodes"]) for r in rows)

    # a target node closing a short row snaps to the last column
    grid = []
    for r in rows:
        cols = list(range(len(r["nodes"])))
        if r["nodes"] and r["nodes"][-1]["kind"] == "target" and len(r["nodes"]) < ncols:
            cols[-1] = ncols - 1
        grid.append(cols)
    colw = [MIN_W] * ncols
    for r, cols in zip(rows, grid):
        for node, c in zip(r["nodes"], cols):
            colw[c] = max(colw[c], node["w"])

    x0 = PAD + (start["w"] + GAP if start else 0)
    colx = []
    x = x0
    for c in range(ncols):
        colx.append(x)
        x += colw[c] + GAP

    # rows, top to bottom
    y, centers = PAD, []
    for r, cols in zip(rows, grid):
        if r["label"]:
            el.append(("label", (colx[0], y + 14, r["label"])))
            y += LABEL_H
        rh = max(nd["h"] for nd in r["nodes"])
        cy = y + rh / 2
        centers.append(cy)
        prev_right = None
        for node, c in zip(r["nodes"], cols):
            node["w"] = colw[c]          # every node in a column shares its width
            nx = colx[c]
            if prev_right is not None:
                el.append(("arrow", [(prev_right, cy), (nx, cy)]))
            el.append(("node", (nx, cy - node["h"] / 2, node)))
            prev_right = nx + node["w"]
        r["_right"], r["_cy"] = prev_right, cy
        y += rh + ROWGAP

    # start node fans out into each row
    if start:
        sy = (min(centers) + max(centers)) / 2
        el.append(("node", (PAD, sy - start["h"] / 2, start)))
        sx = PAD + start["w"]
        firsts = [colx[g[0]] for g in grid]
        if len(rows) == 1:
            el.append(("arrow", [(sx, sy), (firsts[0], centers[0])]))
        else:
            bx = sx + GAP / 2
            el.append(("line", [(sx, sy), (bx, sy)]))
            el.append(("line", [(bx, min(centers)), (bx, max(centers))]))
            for fx, cy in zip(firsts, centers):
                el.append(("arrow", [(bx, cy), (fx, cy)]))

    # end nodes fan out from the last node of the single row
    if ends:
        r = rows[0]
        ew = max(e["w"] for e in ends)
        for e in ends:
            e["w"] = ew                  # end nodes share one width
        ex = colx[-1] + colw[-1] + GAP
        total = sum(e["h"] for e in ends) + END_GAP * (len(ends) - 1)
        ey = r["_cy"] - total / 2
        ecs = []
        for e in ends:
            el.append(("node", (ex, ey, e)))
            ecs.append(ey + e["h"] / 2)
            ey += e["h"] + END_GAP
        if len(ends) == 1:
            el.append(("arrow", [(r["_right"], r["_cy"]), (ex, r["_cy"])]))
        else:
            bx = ex - GAP / 2
            el.append(("line", [(r["_right"], r["_cy"]), (bx, r["_cy"])]))
            el.append(("line", [(bx, min(ecs + [r["_cy"]])), (bx, max(ecs + [r["_cy"]]))]))
            for cy in ecs:
                el.append(("arrow", [(bx, cy), (ex, cy)]))

    # bounds, then shift so everything starts at PAD
    xs, ys = [], []
    for kind, p in el:
        if kind == "node":
            nx, ny, nd = p
            xs += [nx, nx + nd["w"]]
            ys += [ny, ny + nd["h"]]
        elif kind == "label":
            xs.append(p[0]); ys += [p[1] - 14, p[1]]
        else:
            for px, py in p:
                xs.append(px); ys.append(py)
    dx, dy = PAD - min(xs), PAD - min(ys)
    W, H = max(xs) + dx + PAD, max(ys) + dy + PAD

    mid = f"dg-arrow-{uid}"
    parts = [f'<defs><marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
             f'orient="auto-start-reverse"><path class="dg-head" d="M0,0 L10,5 L0,10 z"/></marker></defs>']
    for kind, p in el:
        if kind in ("line", "arrow"):
            (x1, y1), (x2, y2) = p
            mk = f' marker-end="url(#{mid})"' if kind == "arrow" else ""
            parts.append(f'<line class="dg-edge" x1="{x1+dx:.1f}" y1="{y1+dy:.1f}" x2="{x2+dx:.1f}" y2="{y2+dy:.1f}"{mk}/>')
        elif kind == "label":
            lx, ly, text = p
            parts.append(f'<text class="dg-label" x="{lx+dx:.1f}" y="{ly+dy:.1f}">{html.escape(text)}</text>')
        else:
            nx, ny, nd = p
            nx, ny = nx + dx, ny + dy
            cls = f"dg-node {nd['kind']}".strip()
            g = [f'<g class="{cls}"><rect x="{nx:.1f}" y="{ny:.1f}" width="{nd["w"]:.1f}" height="{nd["h"]:.1f}" rx="8"/>']
            ty = ny + PAD_Y + 13
            for t in nd["t"]:
                g.append(f'<text class="dg-title" x="{nx+PAD_X:.1f}" y="{ty:.1f}">{html.escape(t)}</text>')
                ty += TITLE_LH
            ty += 2
            for s in nd["s"]:
                g.append(f'<text class="dg-sub" x="{nx+PAD_X:.1f}" y="{ty:.1f}">{html.escape(s)}</text>')
                ty += SUB_LH
            g.append("</g>")
            parts.append("".join(g))

    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" data-w="{W:.0f}" data-h="{H:.0f}" '
           f'role="img" aria-label="Sơ đồ {html.escape(label)}"><g class="dg-view">{"".join(parts)}</g></svg>')
    return ('<div class="dg" tabindex="0">'
            '<div class="dg-tools">'
            '<button type="button" data-z="in" title="Phóng to" aria-label="Phóng to">+</button>'
            '<button type="button" data-z="out" title="Thu nhỏ" aria-label="Thu nhỏ">−</button>'
            '<button type="button" data-z="fit" title="Vừa khung" aria-label="Vừa khung">Vừa khung</button>'
            '<button type="button" data-z="full" title="Toàn màn hình" aria-label="Toàn màn hình">⛶</button>'
            f'</div>{svg}</div>')



def _inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![\w*])\*([^*]+)\*(?![\w*])", r"<i>\1</i>", s)
    return s


LIST_RE = re.compile(r"^\s*(- |\d+\. )")


def md_to_html(md):
    out, lines, i = [], md.split("\n"), 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("```"):
            j, buf = i + 1, []
            while j < len(lines) and not lines[j].startswith("```"):
                buf.append(lines[j]); j += 1
            out.append("<pre><code>" + html.escape("\n".join(buf), quote=False) + "</code></pre>")
            i = j + 1; continue
        if ln.startswith("### "):
            out.append(f"<h3>{_inline(ln[4:])}</h3>"); i += 1; continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            head = rows[0]
            body = [r for r in rows[1:] if not all(set(c) <= set("-: ") for c in r)]
            tb = "<tr>" + "".join(f"<th>{_inline(c)}</th>" for c in head) + "</tr>"
            tb += "".join("<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in r) + "</tr>" for r in body)
            out.append(f'<div class="nt-tbl"><table>{tb}</table></div>'); continue
        m = LIST_RE.match(ln)
        if m:
            tag = "ol" if m.group(1)[0].isdigit() else "ul"
            items = []
            while i < len(lines) and LIST_RE.match(lines[i]):
                items.append(LIST_RE.sub("", lines[i])); i += 1
            out.append(f"<{tag}>" + "".join(f"<li>{_inline(x)}</li>" for x in items) + f"</{tag}>"); continue
        if not ln.strip():
            i += 1; continue
        buf = []
        while (i < len(lines) and lines[i].strip() and not lines[i].startswith(("```", "### ", "|"))
               and not LIST_RE.match(lines[i])):
            buf.append(lines[i]); i += 1
        out.append(f"<p>{_inline(' '.join(buf))}</p>")
    return "\n".join(out)


def nontech_html(md):
    parts = []
    for s in re.split(r"(?m)^## ", md)[1:]:
        title, body = s.split("\n", 1)
        parts.append(f'<details class="nt"><summary>{html.escape(title.strip())}</summary>'
                     f'<div class="nt-body">{md_to_html(body)}</div></details>')
    return '<h2 class="nt-wrap">Giải thích cho người không làm kỹ thuật</h2>\n' + "\n".join(parts)


# ---------------------------------------------------------------- page

md_main = open(os.path.join(DIR, "mental-model-luong.md"), encoding="utf-8").read()
flow_main = md_main.split("```\n", 1)[1].split("\n```", 1)[0]
diagrams = parse_diagrams(open(os.path.join(DIR, "so-do-cac-buoc.md"), encoding="utf-8").read())

tabs, panels, data = [], [], {}
for step, label, fname in STEPS:
    md = open(os.path.join(DIR, fname), encoding="utf-8").read()
    tab = StepTab(step, md, STEP4_ALIASES if step == 4 else None)
    pid = f"buoc-{step}" if isinstance(step, int) else step
    tabs.append(f'<button class="tab" role="tab" id="tab-{pid}" aria-controls="{pid}" aria-selected="false">{label}</button>')
    specs = diagrams.get(str(step), [])
    body = "".join(svg_diagram(f"{step}-{i}", label, sp) for i, sp in enumerate(specs)) + tab.render()
    panels.append(f'<section class="panel step" role="tabpanel" id="{pid}" aria-labelledby="tab-{pid}" hidden>\n{body}\n</section>')
    data.update(tab.data())
    print(f"step {step}: {len(tab.cards)} cards, {len(tab.seen)} tooltips in text, diagrams={len(specs)}")

page = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
page = page.replace("{{BODY}}", highlight(flow_main))
page = page.replace("{{NONTECH}}", nontech_html(open(os.path.join(DIR, "giai-thich-non-tech.md"), encoding="utf-8").read()))
page = page.replace("{{TABS}}", "\n  ".join(tabs))
page = page.replace("{{PANELS}}", "\n\n".join(panels)
                    + '\n<script type="application/json" id="kw-data">'
                    + json.dumps(data, ensure_ascii=False).replace("</", "<\\/") + "</script>")
open(os.path.join(DIR, "luong-mot-luot-hoi.html"), "w", encoding="utf-8").write(page)
print("ok")
