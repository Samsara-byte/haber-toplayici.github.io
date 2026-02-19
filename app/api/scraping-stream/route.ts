export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { buildStatusResponse, getScrapingState } from "@/lib/scraping-state";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastProgress = -1;
      let attempts = 0;
      const MAX_ATTEMPTS = 120; // 60 saniye (500ms * 120)

      const interval = setInterval(() => {
        attempts++;

        try {
          const state = getScrapingState();
          const currentProgress = state.progress;
          const completed = state.completed;

          if (currentProgress !== lastProgress || completed) {
            const data = buildStatusResponse();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
            );
            lastProgress = currentProgress;
          }

          if ((completed && !state.is_scraping) || attempts >= MAX_ATTEMPTS) {
            clearInterval(interval);
            controller.close();
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 500);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
