import API_BASE from './constants';

/**
 * Submit clinical notes for diagnosis (non-streaming).
 */
export async function submitDiagnosis(notes, threadId = null) {
  const body = { notes };
  if (threadId) body.thread_id = threadId;

  const res = await fetch(`${API_BASE}/v1/diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Diagnosis failed');
  }

  return res.json();
}

/**
 * Stream diagnosis pipeline progress via SSE.
 * Returns an EventSource-like interface.
 */
export function streamDiagnosis(notes, threadId, onEvent, onError, onComplete) {
  const controller = new AbortController();

  (async () => {
    try {
      const body = { notes };
      if (threadId) body.thread_id = threadId;

      const res = await fetch(`${API_BASE}/v1/diagnose/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Stream failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.stage === 'complete') {
                onComplete?.(data);
              } else if (data.stage === 'error') {
                onError?.(new Error(data.detail));
              } else {
                onEvent?.(data);
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      onComplete?.({});
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err);
      }
    }
  })();

  return { abort: () => controller.abort() };
}

/**
 * Retrieve a saved case by thread ID.
 */
export async function getCase(threadId) {
  const res = await fetch(`${API_BASE}/v1/cases/${threadId}`);
  if (!res.ok) throw new Error('Case not found');
  return res.json();
}

/**
 * Check API health.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/v1/health`);
    if (!res.ok) return { api: 'error', neo4j: 'unknown', llm: 'unknown' };
    return res.json();
  } catch {
    return { api: 'error', neo4j: 'unknown', llm: 'unknown' };
  }
}
