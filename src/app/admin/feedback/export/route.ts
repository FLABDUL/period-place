import { requireAdmin } from "@/lib/auth";
import { buildBetaFeedbackCsv } from "@/lib/beta-reporting";
import { listAllFeedback } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  const feedback = await listAllFeedback();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${buildBetaFeedbackCsv(feedback)}`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="period-place-beta-feedback-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
