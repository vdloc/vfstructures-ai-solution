"""Mô hình chi phí VF Structures AI Assistant — tính bằng code, không tính nhẩm.

Đơn giá: prices-eu-central-1.json (AWS Price List Bulk API, on-demand, USD).
Giả định: khối ASSUMPTIONS bên dưới. Mọi con số là GIẢ ĐỊNH cho tới khi có số đo thật;
thay bằng số đọc từ `usage` của event `done` và từ Cost Explorer khi hệ thống chạy.

Chạy:  python3 cost_model.py [prices.json]   → in bảng markdown.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "prices-eu-central-1.json")))
H = P["hours_per_month"]
M = P["model_per_1M_tokens"]
GR = P["guardrails_per_1K_text_units"]
CHARS_PER_TOKEN = 4          # giả định cho tiếng Pháp / tiếng Việt kỹ thuật; đo lại

# ---------------------------------------------------------------- giả định

ASSUMPTIONS = {
    # Kích thước prompt (token). Trần output lấy từ 01-kien-truc.md §8.3; phần còn lại là giả định.
    "router": {"static": 1500, "history_3": 600, "question": 80, "page_context": 200, "output": 150},
    "rag": {"static_cached": 2500, "history": 1500, "chunks": 12, "tokens_per_chunk": 400,
            "question": 80, "output": 600},
    "case": {"static_cached": 2500, "history": 1500, "cases": 5, "tokens_per_case": 300,
             "question": 80, "output": 500},
    # Tool loop: mỗi vòng gửi lại toàn bộ ngữ cảnh + kết quả các vòng trước.
    # Harness có dùng prompt caching hay không CHƯA kiểm chứng → mặc định KHÔNG cache (bảo thủ).
    "tool_loop": {"static": 4000, "history": 1500, "question": 80, "tool_result": 1200,
                  "output_per_round": 350, "final_output": 700, "harness_caches_static": False},
    "rounds": {"calc": 3, "mixed": 4, "explain_result": 3, "optimize": 7},
    # Guardrails: policy bật = content filter (gồm prompt attack) + denied topics + PII (paid)
    "guardrail_policies_input": ["content_filter", "denied_topics", "sensitive_info_paid"],
    "guardrail_policies_output": ["content_filter", "denied_topics", "sensitive_info_paid"],
    "grounding_on": False,     # contextual grounding là lớp phụ; bật thì cộng thêm
    "rerank": "mkb_managed",   # hoặc "cohere_rerank_3_5" (V-K6)
    "retrieve_calls_rag": 2,   # Retrieve chính + Retrieve chunk lân cận
    # AgentCore Runtime cho Harness: thời gian CPU hoạt động mỗi lượt tool loop (giả định)
    "harness_active_vcpu_seconds": 8, "harness_GB": 2, "harness_session_seconds": 30,
}

MIX = {  # tỉ trọng loại câu hỏi (giả định)
    "doc_qa": 0.50, "app_help": 0.05, "calc": 0.15, "explain_result": 0.08, "mixed": 0.07,
    "optimize": 0.03, "case_lookup": 0.05, "out_of_scope": 0.02, "rejected_by_guardrail": 0.05,
}

SCENARIOS = {  # kỹ sư hoạt động × lượt / kỹ sư / ngày làm việc × 22 ngày
    "Thí điểm": (20, 8),
    "Một công ty": (60, 15),
    "Mở rộng": (250, 15),
}
WORKING_DAYS = 22


def usd(tokens, price_per_1M):
    return tokens * price_per_1M / 1_000_000


def gr_cost(chars, policies):
    units = math.ceil(chars / P["guardrails_text_unit_chars"])
    return units * sum(GR[p] for p in policies) / 1000


# ---------------------------------------------------------------- chi phí một lượt

def router_cost():
    a = ASSUMPTIONS["router"]
    inp = a["static"] + a["history_3"] + a["question"] + a["page_context"]   # dưới ngưỡng cache 4 096 của Haiku
    return usd(inp, M["haiku_4_5"]["input"]) + usd(a["output"], M["haiku_4_5"]["output"])


def input_guardrail_cost():
    q_chars = ASSUMPTIONS["router"]["question"] * CHARS_PER_TOKEN
    return gr_cost(q_chars, ASSUMPTIONS["guardrail_policies_input"])


def answer_guardrail_cost(output_tokens, context_tokens):
    """guardrailConfig trên ConverseStream: soát câu trả lời + nội dung bọc guardContent."""
    out = gr_cost(output_tokens * CHARS_PER_TOKEN, ASSUMPTIONS["guardrail_policies_output"])
    ctx = gr_cost(context_tokens * CHARS_PER_TOKEN, ASSUMPTIONS["guardrail_policies_input"])
    g = 0.0
    if ASSUMPTIONS["grounding_on"]:
        g = gr_cost((output_tokens + context_tokens) * CHARS_PER_TOKEN, ["contextual_grounding"])
    return out + ctx + g


def rag_cost():
    a = ASSUMPTIONS["rag"]
    ctx = a["chunks"] * a["tokens_per_chunk"]
    fresh = a["history"] + ctx + a["question"]
    model = (usd(a["static_cached"], M["sonnet_5"]["cache_read"]) + usd(fresh, M["sonnet_5"]["input"])
             + usd(a["output"], M["sonnet_5"]["output"]))
    kb = ASSUMPTIONS["retrieve_calls_rag"] * P["knowledge_base"]["retrieve_per_query"]
    rr = P["rerank_per_query"][ASSUMPTIONS["rerank"]]
    return {"model": model, "kb": kb, "rerank": rr, "guardrail": answer_guardrail_cost(a["output"], ctx + a["question"])}


def case_cost():
    a = ASSUMPTIONS["case"]
    ctx = a["cases"] * a["tokens_per_case"]
    fresh = a["history"] + ctx + a["question"]
    model = (usd(a["static_cached"], M["sonnet_5"]["cache_read"]) + usd(fresh, M["sonnet_5"]["input"])
             + usd(a["output"], M["sonnet_5"]["output"]))
    return {"model": model, "guardrail": answer_guardrail_cost(a["output"], ctx + a["question"])}


def tool_loop_cost(rounds):
    a = ASSUMPTIONS["tool_loop"]
    total_in = total_cached = 0
    for r in range(rounds):
        grown = a["history"] + a["question"] + r * (a["tool_result"] + a["output_per_round"])
        if a["harness_caches_static"]:
            total_cached += a["static"]
            total_in += grown
        else:
            total_in += a["static"] + grown
    out = (rounds - 1) * a["output_per_round"] + a["final_output"]
    model = usd(total_in, M["sonnet_5"]["input"]) + usd(total_cached, M["sonnet_5"]["cache_read"]) + usd(out, M["sonnet_5"]["output"])
    tool_calls = rounds - 1
    gw = tool_calls * P["agentcore"]["gateway_per_invocation"]
    rt = (ASSUMPTIONS["harness_active_vcpu_seconds"] / 3600 * P["agentcore"]["runtime_vcpu_hour"]
          + ASSUMPTIONS["harness_GB"] * ASSUMPTIONS["harness_session_seconds"] / 3600 * P["agentcore"]["runtime_GB_hour"])
    gr = answer_guardrail_cost(a["final_output"], 0)
    return {"model": model, "agentcore": gw + rt, "guardrail": gr}


def turn_cost(intent):
    base = {"router": 0.0, "input_guardrail": input_guardrail_cost()}
    if intent == "rejected_by_guardrail":          # chặn ở ApplyGuardrail INPUT, không gọi mô hình
        return base
    base["router"] = router_cost()
    if intent == "out_of_scope":
        return base
    if intent in ("doc_qa", "app_help"):
        base.update(rag_cost())
    elif intent == "case_lookup":
        base.update(case_cost())
    else:
        base.update(tool_loop_cost(ASSUMPTIONS["rounds"][intent]))
    return base


# ---------------------------------------------------------------- chi phí cố định mỗi tháng

def fixed_monthly():
    au, f = P["aurora_postgresql"], P["fargate"]
    items = {
        "Aurora PostgreSQL Serverless v2, tối thiểu 0,5 ACU luôn bật": 0.5 * au["serverless_v2_ACU_hour"] * H,
        "Aurora storage 20 GB": 20 * au["storage_GB_month"],
        "Knowledge Base storage 1 GB (giả định)": 1 * P["knowledge_base"]["storage_per_GB_month"],
        "Fargate ARM: Assistant.Api 2×(1 vCPU, 2 GB)": 2 * (1 * f["arm_vcpu_hour"] + 2 * f["arm_GB_hour"]) * H,
        "Fargate ARM: Tool facade 2×(0,5 vCPU, 1 GB)": 2 * (0.5 * f["arm_vcpu_hour"] + 1 * f["arm_GB_hour"]) * H,
        "Fargate ARM: Worker 1×(1 vCPU, 2 GB)": 1 * (1 * f["arm_vcpu_hour"] + 2 * f["arm_GB_hour"]) * H,
        "VPC interface endpoint: 8 endpoint × 2 AZ": 8 * 2 * P["vpc"]["interface_endpoint_hour_per_AZ"] * H,
        "KMS: 5 khóa customer-managed": 5 * P["kms"]["key_month"],
        "Secrets Manager: 4 secret": 4 * P["secrets_manager"]["secret_month"],
        "CloudWatch Logs: 10 GB ghi vào + lưu": 10 * (P["cloudwatch"]["logs_ingest_GB"] + P["cloudwatch"]["logs_storage_GB_month"]),
        "CloudWatch: 30 metric + 15 alarm": 30 * P["cloudwatch"]["metric_month"] + 15 * P["cloudwatch"]["alarm_month"],
    }
    return items


def opensearch_compare():
    os_, au = P["opensearch_serverless"], P["aurora_postgresql"]
    rows = [
        ("OpenSearch Serverless, giữ ấm: search 2 OCU, indexing 0", 2 * os_["search_OCU_hour"] * H),
        ("OpenSearch Serverless, giữ ấm: search 2 OCU + indexing 2 OCU", (2 * os_["search_OCU_hour"] + 2 * os_["indexing_OCU_hour"]) * H),
    ]
    for n in (10_000, 100_000, 1_000_000):
        gb = n * 2 * 1024 / 1024 ** 3          # giả định 2 KB mỗi case kể cả index
        rows.append((f"Aurora: thêm {n:,} case × 2 KB ({gb:.2f} GB)".replace(",", " "), gb * au["storage_GB_month"]))
    return rows


# ---------------------------------------------------------------- in báo cáo

def fmt(x, d=4):
    return f"{x:.{d}f}".replace(".", ",")


def main():
    print("## Chi phí một lượt theo loại câu hỏi (USD)\n")
    comps = ["input_guardrail", "router", "model", "kb", "rerank", "agentcore", "guardrail"]
    print("| Loại | " + " | ".join(comps) + " | Tổng |")
    print("|---" * (len(comps) + 2) + "|")
    per = {}
    for intent in MIX:
        c = turn_cost(intent)
        per[intent] = sum(c.values())
        print(f"| {intent} | " + " | ".join(fmt(c.get(k, 0.0), 5) for k in comps) + f" | **{fmt(per[intent], 5)}** |")
    avg = sum(MIX[i] * per[i] for i in MIX)
    print(f"\nChi phí trung bình một lượt theo tỉ trọng MIX: **${fmt(avg, 5)}**\n")

    model_share = sum(MIX[i] * (turn_cost(i).get("model", 0) + turn_cost(i).get("router", 0)) for i in MIX) / avg
    print(f"Tỉ trọng token mô hình trong chi phí biến đổi: **{fmt(model_share * 100, 1)}%**\n")

    fixed = fixed_monthly()
    fixed_total = sum(fixed.values())
    print("## Chi phí cố định mỗi tháng (USD)\n")
    print("| Khoản | USD/tháng |\n|---|---|")
    for k, v in fixed.items():
        print(f"| {k} | {fmt(v, 2)} |")
    print(f"| **Tổng cố định** | **{fmt(fixed_total, 2)}** |\n")

    print("## Ba kịch bản lưu lượng (USD/tháng)\n")
    print("| Kịch bản | Kỹ sư | Lượt/kỹ sư/ngày | Lượt/tháng | Biến đổi | Cố định | Tổng | USD/kỹ sư |")
    print("|---|---|---|---|---|---|---|---|")
    for name, (users, turns) in SCENARIOS.items():
        n = users * turns * WORKING_DAYS
        var = n * avg
        tot = var + fixed_total
        print(f"| {name} | {users} | {turns} | {n:,}".replace(",", " ") +
              f" | {fmt(var, 2)} | {fmt(fixed_total, 2)} | **{fmt(tot, 2)}** | {fmt(tot / users, 2)} |")

    print("\n## Độ nhạy: đổi một giả định, giữ nguyên phần còn lại (kịch bản Một công ty)\n")
    users, turns = SCENARIOS["Một công ty"]
    n = users * turns * WORKING_DAYS
    base_total = n * avg + fixed_total
    tests = [
        ("Rerank bằng Cohere thay cho reranker của MKB", ("rerank", "cohere_rerank_3_5")),
        ("Harness có prompt caching cho phần tĩnh", ("tool_loop", "harness_caches_static", True)),
        ("Bật contextual grounding cho mọi câu trả lời", ("grounding_on", True)),
    ]
    print("| Thay đổi | Tổng mới | Chênh |\n|---|---|---|")
    for label, change in tests:
        saved = json.dumps(ASSUMPTIONS)
        if len(change) == 2:
            ASSUMPTIONS[change[0]] = change[1]
        else:
            ASSUMPTIONS[change[0]][change[1]] = change[2]
        new_avg = sum(MIX[i] * sum(turn_cost(i).values()) for i in MIX)
        new_total = n * new_avg + fixed_total
        print(f"| {label} | {fmt(new_total, 2)} | {'+' if new_total >= base_total else ''}{fmt(new_total - base_total, 2)} |")
        ASSUMPTIONS.clear(); ASSUMPTIONS.update(json.loads(saved))

    print("\n## So sánh kho case: OpenSearch Serverless và Aurora (USD/tháng)\n")
    print("| Phương án | USD/tháng |\n|---|---|")
    for k, v in opensearch_compare():
        print(f"| {k} | {fmt(v, 2)} |")


if __name__ == "__main__":
    main()
