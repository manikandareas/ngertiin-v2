import { readFile, writeFile } from "node:fs/promises";

const [snapshotPath, outputPath, logsPath] = process.argv.slice(2);
if (!snapshotPath || !outputPath) {
  throw new Error(
    "Usage: bun scripts/chat-operations.mjs snapshot.json dashboard.html [api-log.jsonl]",
  );
}
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const events = logsPath
  ? (await readFile(logsPath, "utf8")).split("\n").flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    })
  : [];
// Explicit numeric/status projection: never copy arbitrary log bodies into the report.
const finished = events.filter((event) => event.event === "chat.run_finished");
const counts = new Map();
for (const run of finished) {
  const status = ["not_requested", "FOUND", "NO_MATCH", "UNAVAILABLE", "CANCELLED"].includes(
    run.imageStatus,
  )
    ? run.imageStatus
    : "unknown";
  counts.set(status, (counts.get(status) ?? 0) + 1);
}
const sum = (key) =>
  finished.reduce(
    (total, event) => total + (Number.isFinite(event[key]) && event[key] >= 0 ? event[key] : 0),
    0,
  );
const tools = {
  sampledRuns: finished.length,
  modelCalls: sum("modelCallCount"),
  toolCalls: sum("toolCallCount"),
  imageOutcomes: Object.fromEntries(counts),
  recoveredRuns: events.filter((e) => e.event === "chat.run_recovered").length,
};
const escapeHtml = (value) =>
  String(value ?? "unknown").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const block = (title, data) =>
  `<section><h2>${escapeHtml(title)}</h2><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre></section>`;
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chat operations snapshot</title><style>body{font:16px system-ui;background:#f6f5f2;color:#222;margin:32px auto;padding:0 20px;max-width:1100px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}section{background:white;padding:20px;border:1px solid #ddd;border-radius:12px}h1{font-size:26px}h2{font-size:18px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}p{line-height:1.5}</style>
<h1>Chat operations snapshot</h1><p>Captured ${escapeHtml(snapshot.capturedAt)}. Database window: ${escapeHtml(snapshot.window)}. Terminal latency includes queue time. Cancellation and interruption are separate from failures.</p>
<main>${block("Run status and latency", snapshot.runs)}${block("Queue and leases", snapshot.queue)}${block("Provider usage", snapshot.usage)}${block("Index coverage", snapshot.indexCoverage)}${block("OCR", snapshot.ocr)}${block("Attachment cleanup pending", snapshot.attachmentCleanupPending)}${block("Supplied log sample", logsPath ? tools : "NOT PROVIDED")}</main>
<p>Logs and database may cover different periods. Usage with partial/unavailable coverage is not a complete bill. Cost requires the actual provider tariff/invoice; no price or throughput target is inferred here. This file is an offline snapshot, not a live monitoring service.</p></html>`;
await writeFile(outputPath, html);
console.log("Chat operations dashboard written.");
