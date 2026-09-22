# 15 · Chi tiết cài đặt DevOps

> **Mục này trả lời:** dựng hạ tầng thế nào, dưới dạng code: tài khoản và môi trường, cấu trúc CDK, mạng, khóa KMS, IAM role, database, Bedrock và AgentCore, quan sát, phanh chi phí, CI/CD.
>
> **Quan hệ với 05 và 09:** [05](05-devops.md) nói **phải dựng gì và vì sao**, [09](09-trien-khai.md) nói topology và phát hành. File này nói **viết hạ tầng dưới dạng code thế nào**. Lệch nhau thì [01](01-kien-truc.md) thắng.
>
> **Ai đọc:** đội DevOps AWS.

---

## Giả định của file này

| Giả định | Vì sao phải giả định | Đổi thì ảnh hưởng gì |
| --- | --- | --- |
| Container chạy trên **ECS Fargate, ARM64** | Q4 (nền tảng chạy container) chưa chốt ([10](10-rui-ro.md)) | Chỉ đổi `ComputeStack`; các stack khác giữ nguyên |
| Hạ tầng viết bằng **AWS CDK, TypeScript** | Skill `aws-cdk`: CDK là hướng mặc định cho hạ tầng dưới dạng code trên AWS | Terraform thì giữ nguyên danh sách tài nguyên ở đây, viết lại cú pháp |
| **Một tài khoản AWS riêng cho Assistant**, mỗi môi trường một tài khoản (dev, staging, prod) | Model invocation logging bật theo cả tài khoản và region ([06](06-bao-mat.md) §8); tách chi phí gọn nhất ([13](13-chi-phi.md) §7) | Dùng chung tài khoản thì phải tách chi phí bằng tag và chịu log lẫn với nhóm khác |
| Region `eu-central-1` | AD-03, AD-14 | — |

---

## 1. CloudFormation đã hỗ trợ đủ tài nguyên

Đã đọc trực tiếp CloudFormation Template Reference:

| Tài nguyên | Resource type | Ghi chú |
| --- | --- | --- |
| Managed Knowledge Base | `AWS::Bedrock::KnowledgeBase`, `KnowledgeBaseConfiguration.Type = MANAGED` | **Đổi `Type` hay `ManagedKnowledgeBaseConfiguration` là CloudFormation thay mới KB**, tức phải nạp lại toàn bộ tài liệu |
| Data source managed connector | `AWS::Bedrock::DataSource`, `Type = MANAGED_KNOWLEDGE_BASE_CONNECTOR` | Đổi `Type` là thay mới |
| Guardrail | `AWS::Bedrock::Guardrail`, `AWS::Bedrock::GuardrailVersion` | Runbook tạo guardrail ở [05](05-devops.md) bước 2A |
| AgentCore Harness | `AWS::BedrockAgentCore::Harness`, `HarnessEndpoint` | `ExecutionRoleArn`, `HarnessName`, `Model` bắt buộc. **`AllowedTools` mặc định cho phép mọi tool.** Đổi `HarnessName` là thay mới |
| Gateway, target, policy | `AWS::BedrockAgentCore::Gateway`, `GatewayTarget`, `PolicyEngine`, `Policy` | |

Không cần script tay hay custom resource cho các tài nguyên AI. CDK dùng L1 construct (`Cfn*`) sinh từ các resource type này. **Cần phiên bản `aws-cdk-lib` đủ mới** để có L1 của `aws-bedrockagentcore`; kiểm bằng `cdk synth` trên phiên bản đang dùng.

---

## 2. Cấu trúc CDK

```
infra/
├── bin/assistant.ts                 env: { account, region: 'eu-central-1' } tường minh cho từng stage
├── lib/
│   ├── network-stack.ts             VPC, subnet, security group, VPC endpoint
│   ├── keys-stack.ts                5 khóa KMS, key policy                         terminationProtection
│   ├── data-stack.ts                Aurora PostgreSQL, bucket S3 nguồn, Secrets      terminationProtection
│   ├── bedrock-stack.ts             Guardrail + version, Knowledge Base, data source, application inference profile
│   ├── agentcore-stack.ts           Harness, HarnessEndpoint, Gateway, target OpenAPI, PolicyEngine, Policy (Cedar)
│   ├── compute-stack.ts             ECS cluster, 3 service Fargate, ALB, autoscaling
│   ├── observability-stack.ts       log group, alarm, dashboard, CloudTrail data event
│   └── cost-stack.ts                Budgets, Cost Anomaly Detection (stack ở us-east-1 cho Budgets)
├── cdk.json                          "app": "npx tsx bin/assistant.ts"
└── cdk.context.json                  commit vào repo
```

**Quy tắc** (skill `aws-cdk`):
- Stack có dữ liệu (`keys`, `data`) tách riêng và bật `terminationProtection: true`.
- Mọi deploy chạy `cdk synth --strict` → `cdk diff` → `cdk deploy`. Không deploy production mà chưa đọc diff.
- **Không đổi construct ID** của tài nguyên có dữ liệu: đổi ID là đổi logical ID, CloudFormation thay mới tài nguyên. Với Knowledge Base, thay mới nghĩa là nạp lại toàn bộ tài liệu.
- `Aspects.of(app).add(new AwsSolutionsChecks())` (cdk-nag) chạy trong CI; chỉ tắt một luật bằng `NagSuppressions` kèm lý do.
- Không dùng `--hotswap` hay `--express` ngoài môi trường dev.
- Quyền giữa các tài nguyên cấp bằng `grant*()`, không viết policy tay khi L2 có sẵn.

**Mẫu cho Knowledge Base:**

```ts
const kb = new bedrock.CfnKnowledgeBase(this, 'StandardsKb', {        // KHÔNG đổi ID này
  name: `vf-assistant-standards-${stage}`,
  roleArn: kbServiceRole.roleArn,
  knowledgeBaseConfiguration: {
    type: 'MANAGED',
    managedKnowledgeBaseConfiguration: {
      // embeddingModelType MANAGED (nhánh A của AD-06) hoặc CUSTOM + embeddingModelArn (nhánh B)
      // mã hóa: kmsKeyArn của khóa KB, chỉ đặt được lúc tạo
    },
  },
});
kb.applyRemovalPolicy(RemovalPolicy.RETAIN);

new bedrock.CfnDataSource(this, 'StandardsSource', {
  knowledgeBaseId: kb.attrKnowledgeBaseId,
  name: 'standards-s3',
  dataSourceConfiguration: {
    type: 'MANAGED_KNOWLEDGE_BASE_CONNECTOR',
    managedKnowledgeBaseConnectorConfiguration: {
      // connectorParameters: type S3, version "1", connectionConfiguration { bucketName, bucketOwnerAccountId }
    },
  },
});
```

Tên thuộc tính con của `managedKnowledgeBaseConfiguration` và `managedKnowledgeBaseConnectorConfiguration` lấy đúng theo trang CloudFormation tương ứng khi viết; phần chú thích ở trên ghi giá trị đã chốt ở [05](05-devops.md) bước 4A.

**Mẫu cho Harness**, với sáu giá trị phải ghi đè ([01](01-kien-truc.md) §8.4):

```ts
new bedrockagentcore.CfnHarness(this, 'ToolLoop', {
  harnessName: `vf_tool_loop_${stage}`,            // đổi là thay mới; mẫu tên ^[a-zA-Z][a-zA-Z0-9_]{0,39}$
  executionRoleArn: harnessRole.roleArn,
  model: { /* eu.anthropic.claude-sonnet-5, apiFormat converse_stream, guardrailConfig có version, trace disabled */ },
  maxIterations: 5,
  timeoutSeconds: 60,
  maxTokens: 4000,
  allowedTools: [ /* chỉ các tool của Gateway vf-tools; KHÔNG shell, KHÔNG file_operations */ ],
  memory: { /* disabled: hội thoại đã ở PostgreSQL */ },
  authorizerConfiguration: {
    customJwtAuthorizer: { discoveryUrl: keycloakDiscoveryUrl, allowedAudience: ['assistant-api'], allowedClients: ['vfstructures-app'] },
  },
  tags: [{ key: 'project', value: 'vf-assistant' }, { key: 'component', value: 'tool-loop' }],
});
```

Lượt `optimize` cần 7 vòng và 90 giây: ghi đè từng lời gọi ở `InvokeHarness` ([14](14-chi-tiet-backend.md) §8), không nâng mặc định của Harness.

---

## 3. Mạng

**VPC:** hai AZ, subnet private cho ECS, Aurora và Harness; subnet public chỉ cho ALB. Không có security group nào mở `0.0.0.0/0` vào subnet private.

**VPC endpoint:**

| Endpoint | Loại | Dùng cho |
| --- | --- | --- |
| `com.amazonaws.eu-central-1.bedrock-runtime` | Interface | `Converse`, `ConverseStream`, `ApplyGuardrail`; Harness gọi mô hình |
| `com.amazonaws.eu-central-1.bedrock-agent-runtime` | Interface | `Retrieve`, `Rerank` |
| `com.amazonaws.eu-central-1.bedrock-agentcore` | Interface | `InvokeHarness` từ `Assistant.Api`. **Kiểm** AgentCore có PrivateLink cho data plane ở region này |
| `com.amazonaws.eu-central-1.ecr.api`, `ecr.dkr` | Interface | Fargate và Harness kéo image |
| `com.amazonaws.eu-central-1.s3` | **Gateway**, không tính tiền | Layer image của ECR; bucket tài liệu nguồn |
| `com.amazonaws.eu-central-1.logs` | Interface | Container gửi log |
| `com.amazonaws.eu-central-1.secretsmanager` | Interface | Chuỗi kết nối database |
| `com.amazonaws.eu-central-1.kms` | Interface | Giải mã secret, dữ liệu |

Mỗi interface endpoint trên hai AZ tốn khoảng $17,52 mỗi tháng ([13](13-chi-phi.md) §6). Tám endpoint là khoản cố định lớn nhất trong hóa đơn hạ tầng.

**Endpoint policy:** mỗi endpoint Bedrock gắn policy chỉ cho đúng các action trong IAM policy của role gọi, thay cho policy mặc định cho phép mọi thứ.

**NAT gateway:** Harness ở chế độ VPC **không** cần NAT nếu đủ `ecr.dkr`, `ecr.api`, `s3`, `bedrock-runtime` (V-A10, [README](README.md)). `Assistant.Api` và tool facade vẫn cần gọi Keycloak, Main API, Authorization API, Payment API. Các hệ thống này nằm trong cùng VPC hay qua peering thì không cần NAT; nằm ngoài AWS thì cần NAT và phải liệt kê đích đi ra.

**ALB và SSE:** `idle_timeout` ≥ 120 giây; target group `deregistration_delay` ≥ 90 giây, để lượt `optimize` đang chạy không bị cắt khi deploy; không đặt CloudFront trước `/v1/chat`, hoặc tắt cache cho đường này.

---

## 4. Năm khóa KMS

| Khóa | Mã hóa gì | Key policy cho ai | Điểm dễ sai |
| --- | --- | --- | --- |
| `vf-assistant-db` | Aurora cluster, snapshot | Service RDS qua `kms:ViaService = rds.eu-central-1.amazonaws.com` | Chỉ đặt được lúc tạo cluster |
| `vf-assistant-s3-source` | Bucket tài liệu nguồn, SSE-KMS | Role `assistant-ingest` (ghi); **service role của KB** `kms:Decrypt` với `kms:ViaService = s3.eu-central-1.amazonaws.com` | Bật **S3 Bucket Key** để giảm số request KMS |
| `vf-assistant-kb` | Knowledge Base, dữ liệu tạm lúc nạp và dữ liệu lưu | **Danh tính tạo KB** (role deploy của CDK). **Service role của KB không cần quyền trên khóa này** | Chỉ đặt được lúc tạo KB; Bedrock tự tạo grant và thu hồi khi xóa KB |
| `vf-assistant-logs` | Mọi log group | Service principal `logs.eu-central-1.amazonaws.com`, điều kiện `kms:EncryptionContext:aws:logs:arn` khớp ARN log group của tài khoản | Thiếu quyền của service `logs` thì tạo log group thất bại |
| `vf-assistant-guardrail` | Cấu hình guardrail (`KmsKeyId`) | Role deploy; role gọi guardrail | API không bắt buộc, thiết kế bắt buộc: cấu hình chứa danh sách chủ đề cấm |

Bật **tự động xoay khóa** hằng năm cho cả năm khóa. Không dùng chung một khóa cho mọi thứ: tách khóa thì thu hồi được từng phần mà không làm hỏng cả hệ thống.

---

## 5. IAM role

| Role | Dùng bởi | Quyền chính | Không bao giờ có |
| --- | --- | --- | --- |
| `assistant-runtime` | Task role của `Assistant.Api` | `bedrock:InvokeModel`, `InvokeModelWithResponseStream` theo ARN profile `eu.*` của Sonnet 5, Haiku 4.5, Sonnet 4.6; `bedrock:ApplyGuardrail` trên ARN guardrail; `bedrock:Retrieve` trên ARN KB; `bedrock:Rerank` (`Resource: "*"`, statement riêng); `bedrock-agentcore:InvokeHarness` và `InvokeAgentRuntime`; **Deny** gọi mô hình chat khi `bedrock:GuardrailIdentifier` khác ARN guardrail đã đánh số | Quyền ghi bucket nguồn; `bedrock:*`; `InvokeAgentRuntimeCommand` |
| `tool-facade` | Task role của tool facade | `bedrock:ApplyGuardrail`; secret database | Gọi mô hình |
| `assistant-ingest` | Task role của `Assistant.Worker` | Ghi và đọc bucket nguồn; `bedrock:StartIngestionJob`, `GetIngestionJob` trên KB; `bedrock:ApplyGuardrail` nếu soát chunk lúc nạp ([13](13-chi-phi.md) §6) | `Rerank`; gọi mô hình chat |
| `kb-service` | Bedrock đóng vai để đọc S3 | `s3:ListBucket`, `s3:GetObject` đúng ARN bucket, điều kiện `aws:ResourceAccount`; `kms:Decrypt` khóa bucket với `kms:ViaService`; `cloudwatch:PutMetricData` namespace `AWS/Bedrock/KnowledgeBases`. Trust: `bedrock.amazonaws.com` + `aws:SourceAccount` + `aws:SourceArn` đúng KB ID | Quyền trên khóa KMS của KB |
| `harness-execution` | Harness | Gọi `eu.anthropic.claude-sonnet-5`; `bedrock:ApplyGuardrail`; kéo image ECR; gọi Gateway | Bất kỳ quyền nào ngoài danh sách trong trang Harness security |
| Task execution role | ECS | Kéo image ECR, đọc secret lúc khởi động, ghi log | Quyền ứng dụng |
| `ci-deploy` | GitHub Actions qua **OIDC** | Assume role CDK bootstrap của từng tài khoản | Access key tĩnh |

Không dùng `bedrock:*` hay `AmazonBedrockFullAccess` ở bất kỳ role nào. Quyền Marketplace (`aws-marketplace:Subscribe`) chỉ cấp cho một role quản trị, dùng một lần để bật mô hình ([06](06-bao-mat.md)).

---

## 6. Database

| Mục | Giá trị |
| --- | --- |
| Engine | Aurora PostgreSQL, **Serverless v2** |
| ACU | Prod: tối thiểu 0,5, tối đa theo đo tải; một writer và một reader ở AZ khác. Dev: tối thiểu 0 để tự dừng khi rảnh |
| Extension | `fuzzystrmatch` (AD-29). **Không** `pgvector` (AD-17, AD-28) |
| Parameter group | `rds.force_ssl = 1` |
| Mã hóa | Khóa `vf-assistant-db` |
| Backup | Giữ tối thiểu 14 ngày; snapshot thủ công trước mỗi migration lớn |
| Role | `assistant_owner` chạy migration; `assistant_app` cho ứng dụng, không owner, không `BYPASSRLS` ([14](14-chi-tiet-backend.md) §2) |
| Secret | Secrets Manager, **bật xoay tự động** |
| Giám sát | Performance Insights; alarm trên ACU gần trần và trên số kết nối |

Aurora DSQL bị loại (AD-12): không hỗ trợ extension (thiết kế cần `fuzzystrmatch`), không PL/pgSQL, giới hạn 3 000 dòng mỗi transaction. Skill `aws-database` xác nhận DSQL không có extension nào, kể cả `pg_trgm` và `pgvector`.

---

## 7. Bedrock

| Việc | Cách làm |
| --- | --- |
| Bật mô hình | Một lần, bằng role quản trị: Sonnet 5, Haiku 4.5, Sonnet 4.6, Cohere Rerank 3.5 (nếu V-K6 chọn), Opus 5 cho eval |
| Quota | Xin tăng TPM và RPM cho Sonnet 5, Haiku 4.5 ở `eu-central-1` **trước mọi việc khác**; duyệt 1–3 ngày làm việc ([05](05-devops.md) bước 3) |
| Application inference profile | Tạo riêng cho router, trả lời RAG, tool loop; gắn tag `component`. Backend dùng ARN profile thay cho model ID. Kích hoạt tag làm cost allocation tag; tag hiện trong Cost Explorer sau khoảng 24 giờ |
| Guardrail | Theo runbook [05](05-devops.md) bước 2A; `GuardrailVersion` đánh số, không dùng `DRAFT` ở prod |
| Model invocation logging | Prod: chỉ metadata, tắt ghi text. Staging và dev: ghi đầy đủ, retention ngắn. Đích là log group mã hóa bằng khóa `vf-assistant-logs` |
| Knowledge Base | Tạo bằng CDK (mục 2). Sau deploy: poll tới `ACTIVE`, data source tới `AVAILABLE`, rồi mới `start-ingestion-job`. Bật vended log (`APPLICATION_LOGS`, `TRACES`) |
| CloudTrail | Data event cho `AWS::Bedrock::KnowledgeBase` và `AWS::Bedrock::Guardrail`; mặc định không ghi. Alarm trên `UpdateGuardrail`, `DeleteGuardrail` |

---

## 8. Quan sát

**Log group:** tất cả mã hóa bằng khóa `vf-assistant-logs`, retention 30 ngày ở prod (chờ chốt theo retention của [06](06-bao-mat.md)), quyền đọc hẹp.

**Alarm tối thiểu:**

| Alarm | Nguồn | Ngưỡng khởi điểm |
| --- | --- | --- |
| Bedrock bị throttle | `AWS/Bedrock` `InvocationThrottles` theo model | > 0 trong 5 phút liên tiếp |
| Bedrock lỗi phía server | `AWS/Bedrock` `InvocationServerErrors` | > 1% số lời gọi |
| Độ trễ mô hình | `AWS/Bedrock` `InvocationLatency` p95 | Theo số đo đầu tiên |
| Knowledge Base lỗi | `AWS/Bedrock/KnowledgeBases` `ServerErrors`, `Throttles` | > 0 |
| Ingestion thất bại | Sự kiện ingestion job | Mọi lần thất bại |
| Tỉ lệ `CompletedUnverified` | Metric ứng dụng, theo ngày và theo intent | Tăng so với tuần trước |
| Tỉ lệ `degraded_routing` | Metric ứng dụng | > 2% số lượt |
| Chữ đầu tiên p95 | Metric ứng dụng | > 3 giây |
| Guardrail can thiệp | Metric ứng dụng từ `audit_event` | Thay đổi đột ngột |
| Aurora gần trần ACU | `AWS/RDS` `ServerlessDatabaseCapacity` | > 80% trần |
| ECS task khởi động lại | Sự kiện ECS | Mọi lần |

Tên metric `AWS/Bedrock` kiểm lại trên tài khoản thật bằng `aws cloudwatch list-metrics --namespace AWS/Bedrock`.

**Trace:** OTLP từ `Assistant.Api`, tool facade, `Assistant.Worker` về CloudWatch; mọi span mang `correlation_id`; Harness gắn tag để truy chi phí ([08](08-eval-quan-sat.md)).

---

## 9. Phanh chi phí

Theo skill `aws-billing-and-cost-management`. API Budgets chỉ chạy ở `us-east-1`.

```bash
aws budgets create-budget --region us-east-1 --account-id "$ACCOUNT" \
  --budget '{"BudgetName":"vf-assistant-monthly","BudgetLimit":{"Amount":"1500","Unit":"USD"},
             "TimeUnit":"MONTHLY","BudgetType":"COST",
             "CostFilters":{"TagKeyValue":["user:project$vf-assistant"]}}' \
  --notifications-with-subscribers '[
    {"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":50,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"SNS","Address":"'"$SNS_ARN"'"}]},
    {"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"SNS","Address":"'"$SNS_ARN"'"}]},
    {"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"SNS","Address":"'"$SNS_ARN"'"}]},
    {"Notification":{"NotificationType":"FORECASTED","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"SNS","Address":"'"$SNS_ARN"'"}]}
  ]'
```

- Mỗi ngưỡng là một mục riêng trong danh sách; không gộp nhiều ngưỡng vào một mục.
- Con số $1 500 lấy từ kịch bản "Một công ty" ở [13](13-chi-phi.md) §5 cộng biên; chốt lại sau khi có số đo thật.
- Cảnh báo Budgets đánh giá mỗi ngày một lần, nên trễ tới 24 giờ. Phanh theo giờ là quota ngày trong ứng dụng (AD-23), không phải Budgets.
- **Cost Anomaly Detection:** một monitor theo service, theo dõi riêng Amazon Bedrock, gửi cảnh báo vào cùng SNS topic.
- Tag bắt buộc trên mọi tài nguyên: `project=vf-assistant`, `env`, `component`. Bật làm cost allocation tag.

---

## 10. CI/CD

| Bước | Việc | Chặn merge hay deploy khi |
| --- | --- | --- |
| 1 | `dotnet build`, unit test, architecture test (NetArchTest) | Có test đỏ |
| 2 | Integration test với Testcontainers PostgreSQL, hai organization | Có test đỏ |
| 3 | Eval gate trên golden set ([08](08-eval-quan-sat.md)) | Chất lượng giảm, p95 tăng quá 5%, chi phí mỗi lượt vượt ngân sách |
| 4 | `cdk synth --strict` + cdk-nag | Có lỗi nag chưa được giải trình |
| 5 | `cdk diff` gắn vào pull request | Diff có thay mới tài nguyên có dữ liệu (`Replace` trên KB, Aurora, bucket, khóa KMS) mà PR không ghi rõ lý do |
| 6 | Deploy staging, `curl -N` qua đúng tuyến thật | Event SSE dồn cục |
| 7 | Duyệt tay, deploy prod | — |

Xác thực GitHub Actions bằng **OIDC**, không dùng access key tĩnh. Bootstrap CDK có `--custom-permissions-boundary`.

---

## Chưa rõ

| Điểm | Ảnh hưởng |
| --- | --- |
| Q4: nền tảng chạy container | `ComputeStack` |
| AgentCore có PrivateLink cho data plane `InvokeHarness` ở `eu-central-1` không | Có cần đi qua NAT tới AgentCore không |
| Keycloak, Main API, Payment API nằm ở đâu so với VPC của Assistant | Có cần NAT không, và endpoint nào phải thêm |
| `aws-cdk-lib` bản đang dùng đã có L1 của `aws-bedrockagentcore` chưa | Nếu chưa, nâng phiên bản CDK trước khi viết `AgentCoreStack` |
| Retention cuối cùng của log và dữ liệu | Do công ty và DPO chốt |

---

## Bảng tra nhanh: cái gì không bao giờ được làm

| Không bao giờ | Vì sao |
| --- | --- |
| Đổi construct ID hay `Type` của Knowledge Base mà không đọc `cdk diff` | CloudFormation thay mới KB, phải nạp lại toàn bộ tài liệu |
| Để trống `AllowedTools` của Harness | Mặc định cho phép mọi tool, kể cả `shell` |
| Để mặc định `MaxIterations`, `TimeoutSeconds` của Harness | Một lượt có thể chạy rất lâu và rất tốn |
| Tạo KB mà chưa có khóa KMS | Khóa chỉ đặt được lúc tạo |
| Cấp quyền khóa KMS của KB cho service role của KB | AWS ghi rõ role đó không cần; cấp là thừa quyền |
| Dùng `--hotswap` hay `--express` ở staging hoặc prod | Tạo drift, không rollback được |
| Dùng access key tĩnh trong CI | Dùng OIDC |
| Dùng một khóa KMS cho mọi thứ | Không thu hồi được từng phần |
| Bỏ endpoint `bedrock-agent-runtime` | `Retrieve` không gọi được từ subnet private |
| Tăng lưu lượng trước khi có Budgets và Cost Anomaly Detection | Không có phanh chi phí |

---

## Liên quan

| Cần gì | Đọc |
| --- | --- |
| Phải dựng gì và vì sao, runbook guardrail | [05-devops.md](05-devops.md) |
| Topology, môi trường, phát hành | [09-trien-khai.md](09-trien-khai.md) |
| Backend cần gì từ hạ tầng | [14-chi-tiet-backend.md](14-chi-tiet-backend.md) |
| Đơn giá và các khoản cố định | [13-chi-phi.md](13-chi-phi.md) |
| Bảo mật, retention, logging | [06-bao-mat.md](06-bao-mat.md) |
