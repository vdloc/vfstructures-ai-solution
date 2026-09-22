"""Tải lại đơn giá on-demand ở eu-central-1 từ AWS Price List Bulk API (công khai, không cần credential)
và in các dòng giá mà cost_model.py dùng, để so với prices-eu-central-1.json.

Chạy:  python3 fetch_prices.py
Profile eu.* dùng dòng giá "Standard" / "Regional" / "cross-region-geo"; KHÔNG dùng dòng "Global".
"""
import json
import urllib.request

BASE = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/{svc}/current/eu-central-1/index.json"

CHECKS = [
    # (service code, thuộc tính servicename bắt đầu bằng / None, chuỗi phải có trong usagetype)
    ("AmazonBedrockFoundationModels", "Claude Sonnet 5 (", "input_tokens_standard"),
    ("AmazonBedrockFoundationModels", "Claude Sonnet 5 (", "output_tokens_standard"),
    ("AmazonBedrockFoundationModels", "Claude Sonnet 5 (", "cache_read_tokens_standard"),
    ("AmazonBedrockFoundationModels", "Claude Haiku 4.5 (", "InputTokenCount-Units"),
    ("AmazonBedrockFoundationModels", "Claude Haiku 4.5 (", "OutputTokenCount-Units"),
    ("AmazonBedrockFoundationModels", "Claude Sonnet 4.6 (", "InputTokenCount-Units"),
    ("AmazonBedrockFoundationModels", "Claude Sonnet 4.6 (", "OutputTokenCount-Units"),
    ("AmazonBedrockFoundationModels", "Cohere Rerank v3.5", "search_units"),
    ("AmazonBedrockFoundationModels", "Cohere Embed 4", "InputTokenCount"),
    ("AmazonBedrock", None, "Guardrail-ContentPolicyUnitsConsumed"),
    ("AmazonBedrock", None, "Guardrail-TopicPolicyUnitsConsumed"),
    ("AmazonBedrock", None, "Guardrail-SensitiveInformationPolicyPaidUnitsConsumed"),
    ("AmazonBedrock", None, "Guardrail-ContextualGroundingPolicyUnitsConsumed"),
    ("AmazonBedrockAgentCore", None, "Knowledge-Base:Consumption-based:Retrieval"),
    ("AmazonBedrockAgentCore", None, "Knowledge-Base:Consumption-based:Storage"),
    ("AmazonBedrockAgentCore", None, "Runtime:Consumption-based:vCPU"),
    ("AmazonBedrockAgentCore", None, "Runtime:Consumption-based:Memory"),
    ("AmazonBedrockAgentCore", None, "Gateway:Consumption-based:API-Invocations"),
    ("AmazonRDS", None, "Aurora:ServerlessV2Usage"),
    ("AmazonRDS", None, "Aurora:StorageUsage"),
    ("AmazonES", None, "SearchOCU"),
    ("AmazonES", None, "IndexingOCU"),
    ("awskms", None, "KMS-Keys"),
    ("AmazonVPC", None, "VpcEndpoint-Hours"),
    ("AmazonCloudWatch", None, "DataProcessing-Bytes"),
    ("AmazonECS", None, "Fargate-ARM-vCPU-Hours"),
    ("AmazonECS", None, "Fargate-ARM-GB-Hours"),
]


def load(svc, cache={}):
    if svc not in cache:
        with urllib.request.urlopen(BASE.format(svc=svc)) as r:
            cache[svc] = json.load(r)
    return cache[svc]


def main():
    for svc, name, ut in CHECKS:
        d = load(svc)
        terms = d["terms"].get("OnDemand", {})
        found = set()
        for sku, p in d["products"].items():
            a = p["attributes"]
            if ut not in a.get("usagetype", ""):
                continue
            if name and not a.get("servicename", "").startswith(name):
                continue
            if svc == "AmazonRDS" and a.get("databaseEngine") not in ("Aurora PostgreSQL", None):
                continue
            for t in terms.get(sku, {}).values():
                for pd in t["priceDimensions"].values():
                    found.add((pd["pricePerUnit"].get("USD"), pd["unit"], pd["description"][:70]))
        label = f"{svc} · {name or ''} · {ut}"
        for f in sorted(found):
            print(f"{label:95} {f[0]:>14} / {f[1]:12} {f[2]}")
        if not found:
            print(f"{label:95} KHÔNG TÌM THẤY")
    print("\nPublication dates:", {s: load(s).get("publicationDate") for s in {c[0] for c in CHECKS}})


if __name__ == "__main__":
    main()
