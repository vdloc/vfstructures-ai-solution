#!/usr/bin/env python3
"""Dung payload IngestKnowledgeBaseDocuments tu chunks.json.

Sinh ba thu:
  out/ingest-payload.json  than lenh goi API (toi da 25 tai lieu moi lo)
  out/txt/<id>.txt         noi dung tung chunk, de keo tha tren console
  out/txt/<id>.metadata.json  sidecar co kieu di kem tung file txt

Kiem luon ba tran cua S3 Vectors: 40 KB tong metadata, 2 KB phan loc duoc,
50 khoa moi vector.
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
OUT = HERE / "out"

MAX_DOCS_PER_CALL = 25       # API; console chi cho 10
# Tran cua Bedrock KB khi kho vector la S3 Vectors — chat hon tran cua
# rieng S3 Vectors (40 KB / 2 KB / 50 khoa). Vuot tran thi ingestion job nem loi.
MAX_CUSTOM_METADATA = 1024   # metadata tuy bien moi vector
MAX_KEYS = 35                # so khoa moi vector


def typed(value):
    if isinstance(value, bool):
        return {"type": "BOOLEAN", "booleanValue": value}
    if isinstance(value, int):
        return {"type": "NUMBER", "numberValue": value}
    if isinstance(value, list):
        return {"type": "STRING_LIST", "stringListValue": value}
    return {"type": "STRING", "stringValue": str(value)}


def body(chunk):
    """Mot phan tu cua mang documents."""
    content = f"{chunk['prefix']}\n\n{chunk['text']}"
    attrs = [{"key": k, "value": typed(v)} for k, v in chunk["metadata"].items()]
    return {
        "content": {
            "dataSourceType": "CUSTOM",
            "custom": {
                "customDocumentIdentifier": {"id": chunk["id"]},
                "inlineContent": {
                    "textContent": {"data": content},
                    "type": "TEXT",
                },
                "sourceType": "IN_LINE",
            },
        },
        "metadata": {
            "inlineAttributes": attrs,
            "type": "IN_LINE_ATTRIBUTE",
        },
    }


def check(chunk):
    """Tra ve danh sach canh bao cho mot chunk."""
    warn = []
    custom = len(json.dumps(chunk["metadata"], ensure_ascii=False).encode())

    if len(chunk["metadata"]) > MAX_KEYS:
        warn.append(f"{len(chunk['metadata'])} khoa > {MAX_KEYS}")
    if custom > MAX_CUSTOM_METADATA:
        warn.append(f"metadata tuy bien {custom} B > {MAX_CUSTOM_METADATA} B")
    if any(k.startswith("_") for k in chunk["metadata"]):
        warn.append("co khoa bat dau bang _ (Bedrock danh rieng)")
    return warn, custom


def main():
    chunks = json.loads((HERE / "chunks.json").read_text(encoding="utf-8"))

    ids = [c["id"] for c in chunks]
    if len(set(ids)) != len(ids):
        sys.exit("Trung id: nap len la ghi de, khong bao truoc")

    (OUT / "txt").mkdir(parents=True, exist_ok=True)
    problems = 0

    for c in chunks:
        warn, custom = check(c)
        if warn:
            problems += 1
            print(f"  ! {c['id']}: {'; '.join(warn)}")
        else:
            print(f"  . {c['id']}: metadata {custom} B, {len(c['metadata'])} khoa")

        content = f"{c['prefix']}\n\n{c['text']}"
        (OUT / "txt" / f"{c['id']}.txt").write_text(content, encoding="utf-8")
        sidecar = {"metadataAttributes": {k: {"value": typed(v)} for k, v in c["metadata"].items()}}
        (OUT / "txt" / f"{c['id']}.metadata.json").write_text(
            json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    for i in range(0, len(chunks), MAX_DOCS_PER_CALL):
        lot = chunks[i:i + MAX_DOCS_PER_CALL]
        payload = {
            "knowledgeBaseId": "<KB_ID>",
            "dataSourceId": "<DATA_SOURCE_ID>",
            "documents": [body(c) for c in lot],
        }
        name = "ingest-payload.json" if len(chunks) <= MAX_DOCS_PER_CALL else f"ingest-payload-{i // MAX_DOCS_PER_CALL + 1}.json"
        (OUT / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  -> {name}: {len(lot)} tai lieu")

    print(f"{len(chunks)} chunk, {problems} chunk co canh bao")


if __name__ == "__main__":
    main()
