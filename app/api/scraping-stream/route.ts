import { buildStatusResponse, getScrapingState } from "@/lib/scraping-state";

export async function GET() {
  const encoder = new TextEncoder();
  let lastProgress = -1;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        const msg = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(msg));
      };

      while (true) {
        const state = getScrapingState();
        const currentProgress = state.progress;
        const completed = state.completed;

        if (currentProgress !== lastProgress || completed) {
          send(buildStatusResponse());
          lastProgress = currentProgress;
        }

        if (completed && !state.is_scraping) {
          controller.close();
          break;
        }

        await new Promise((r) => setTimeout(r, 500));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
