# Research: Automated Testing for n8n Workflows

> Date: 2026-03-18
> Status: Research complete, no approach implemented yet

---

## Summary

There is no "JUnit for n8n" out of the box. n8n was not designed with a built-in test runner for workflow logic.
However, there are **5 viable approaches**, ranging from built-in features to fully DIY solutions.

---

## Option 1: n8n Evaluations (Built-in, Enterprise Only)

**What it is**: n8n's official testing/evaluation framework for AI workflows.

**How it works**:
- Define a **test dataset** (input + expected output pairs)
- Run the dataset through your workflow inside n8n
- Compare outputs visually (light eval) or with numeric metrics (metric-based eval)
- Two modes:
  - **Light evaluation** (pre-deployment): handful of test cases, visual comparison
  - **Metric-based evaluation** (post-deployment): large datasets, numeric scoring, regression testing

**Limitations**:
- **Enterprise license required** -- not available on community/self-hosted free tier
- Designed primarily for **AI/LLM workflows** (prompt quality, correctness)
- Not a general-purpose workflow test runner

**Docs**: https://docs.n8n.io/advanced-ai/evaluations/overview/

**Verdict**: Best if you're on Enterprise and want to test AI agent quality. Not applicable for your current self-hosted setup unless you upgrade.

---

## Option 2: Data Pinning + Manual Testing (Built-in, Free)

**What it is**: n8n's built-in mechanism to mock/freeze data at any node.

**How it works**:
- **Data mocking**: Use Code node or Edit Fields node to generate test data
- **Data pinning**: Save a node's output and reuse it in future test runs (avoids hitting external APIs)
- Edit pinned data to test edge cases without re-triggering external systems
- The `pinData` property is available in the workflow JSON, so it can be set programmatically

**Limitations**:
- **Development only** -- pinned data is ignored in production executions
- No automated pass/fail assertions
- No CI integration (it's a UI feature)
- Community consensus: useful for manual testing, not for automated test suites

**Docs**: https://docs.n8n.io/data/data-pinning/

**Verdict**: Good for development-time manual testing. Use it to freeze webhook data, test edge cases, and avoid repeated API calls. But it's not automated testing.

---

## Option 3: "Test Runner" Meta-Workflow (DIY in n8n, Free)

**What it is**: Build an n8n workflow that tests other n8n workflows using the **Execute Workflow** node.

**How it works**:
1. Create a "test harness" workflow with a Manual Trigger or Schedule Trigger
2. Use **Execute Workflow** node to call the target workflow under test
3. Use **If** nodes to evaluate pass/fail conditions on the output
4. Log results to Google Sheets, Postgres, Slack, ClickUp, etc.
5. Handle both success and error paths

**Example template**: [Automated workflow test runner](https://n8n.io/workflows/9408-automated-workflow-test-runner-with-google-drive-sheets-and-clickup-result-logging/)

**Architecture for your project**:
```
[Schedule/Manual Trigger]
  -> [Execute Workflow: waha-ia-dev] with test input
  -> [If: check output contains expected response]
  -> [Success path: log to Postgres system_logs]
  -> [Failure path: alert via WhatsApp/Slack + log error]
```

**Limitations**:
- You're testing the whole workflow, not individual nodes (integration test, not unit test)
- The target workflow needs a Webhook or Execute Workflow trigger
- Error handling in Execute Workflow can be tricky
- No code coverage or node-level assertions

**Verdict**: **Best practical option for your setup.** Free, no external tools, works today. You can build a test suite as a set of n8n workflows that call your dev workflow with known inputs and validate outputs.

---

## Option 4: External Test Script via API (DIY, Free)

**What it is**: Write a test script (Python, Node.js, Bash) that triggers workflows via HTTP and validates responses.

**How it works**:

### 4a. Webhook-based (available now)
If your workflow has a Webhook trigger, POST test data to it and assert on the response:
```bash
# Example with curl
RESPONSE=$(curl -s -X POST http://localhost:5678/webhook/your-webhook-id \
  -H "Content-Type: application/json" \
  -d '{"message": "test input", "phone": "test@c.us"}')

echo "$RESPONSE" | jq '.reply' | grep -q "expected text" && echo "PASS" || echo "FAIL"
```

### 4b. Execute Workflow API (new endpoint)
n8n recently added `POST /api/v1/workflows/{workflowId}/execute`:
```bash
curl -X POST http://localhost:5678/api/v1/workflows/_jCo7E4j09FGztAPboL2J/execute \
  -H "X-N8N-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"data": {"test": true}}'
```

### 4c. Full test suite example (Node.js/Jest)
```javascript
const axios = require('axios');

describe('WAHA workflow', () => {
  const N8N_URL = 'http://localhost:5678';
  const API_KEY = process.env.N8N_API_KEY;

  test('responds to greeting', async () => {
    const res = await axios.post(`${N8N_URL}/webhook/waha-test`, {
      body: 'Hola, tienen resistencias de 10k?',
      from: 'test-number@c.us'
    });
    expect(res.data.reply).toContain('resistencia');
    expect(res.data.reply).not.toContain('undefined');
  });

  test('escalates on frustration', async () => {
    const res = await axios.post(`${N8N_URL}/webhook/waha-test`, {
      body: 'Necesito hablar con alguien real YA',
      from: 'test-number@c.us'
    });
    expect(res.data.action).toBe('escalate');
  });
});
```

**Limitations**:
- The `/execute` API endpoint may not be available in older n8n versions
- Webhook-based testing requires the workflow to respond synchronously (Respond to Webhook node)
- You're testing the full flow end-to-end, including LLM responses (non-deterministic)
- Need to mock or use a test LLM to get deterministic results

**Verdict**: **Most flexible option.** Can integrate with any CI system (GitHub Actions, etc.). Combine with a test webhook on your dev workflow for best results.

---

## Option 5: n8n Benchmarking Suite (Performance Testing)

**What it is**: n8n's official tool for load/performance testing, NOT logic testing.

**Repo**: https://github.com/n8n-io/n8n/tree/master/packages/@n8n/benchmark

**How it works**:
- Uses k6 scripts to send load to n8n workflows
- Measures throughput (up to 220 executions/sec on single instance)
- Defines scenarios with manifest files + test data

**Verdict**: Only useful if you need to load-test n8n performance. Not for testing workflow logic.

---

## Recommended Strategy for This Project

Given the constraints (self-hosted, no Enterprise license, one dev, beta client active):

### Phase 1: Immediate (low effort)
1. **Use data pinning** on the dev workflow (`waha-ia-dev`) to freeze test scenarios
2. **Build a test runner meta-workflow** (Option 3) that:
   - Sends 5-10 known test messages to the dev workflow via Execute Workflow
   - Checks responses for basic correctness (not empty, no errors, contains expected keywords)
   - Logs results to `system_logs` table
   - Runs on schedule (daily) or manual trigger

### Phase 2: Before first paying client
3. **Add a test webhook** to the dev workflow (separate from prod webhook)
4. **Write a simple test script** (Option 4a) in `scripts/test-workflow.sh`:
   - curl-based, sends test messages, checks responses
   - Run before deploying any workflow changes to prod
   - Can be added to a Makefile target: `make test`

### Phase 3: Scaling
5. **Jest/Vitest test suite** (Option 4c) in `portal/` or a new `tests/` directory
6. **GitHub Actions** CI that runs tests on push to `dev` branch
7. **n8n Evaluations** if you move to Enterprise tier

---

## Key Insight: Non-Deterministic LLM Testing

Since the AI agent uses Claude, responses are non-deterministic. Testing strategies:
- **Don't assert exact text** -- assert properties (response exists, is Spanish, mentions product category)
- **Use an LLM-as-judge** pattern: have a second LLM evaluate if the response is "good" (this is what n8n Evaluations does)
- **Test the plumbing, not the AI**: verify routing, escalation triggers, business hours logic, lock/unlock -- these ARE deterministic
- **Snapshot testing**: save "golden" responses and flag when drift exceeds a threshold

---

## Sources

- [n8n Evaluations docs](https://docs.n8n.io/advanced-ai/evaluations/overview/)
- [n8n Data Mocking/Pinning docs](https://docs.n8n.io/data/data-mocking/)
- [n8n Test Runner template](https://n8n.io/workflows/9408-automated-workflow-test-runner-with-google-drive-sheets-and-clickup-result-logging/)
- [n8n Benchmark suite](https://github.com/n8n-io/n8n/tree/master/packages/@n8n/benchmark)
- [n8n Execute Workflow API PR](https://github.com/n8n-io/n8n/pull/20234)
- [n8n CI/CD tutorial (LumaDock)](https://lumadock.com/tutorials/n8n-cicd)
- [Community: Unit testing thread](https://community.n8n.io/t/how-to-do-the-unit-testing-for-each-node-in-workflow/44120)
- [Community: Testing capabilities thread](https://community.n8n.io/t/testing-capabilities/62714)
- [Wednesday.is: n8n QA Framework](https://www.wednesday.is/writing-articles/n8n-workflow-testing-and-quality-assurance-framework)
- [n8n test-workflows repo](https://github.com/n8n-io/test-workflows)
