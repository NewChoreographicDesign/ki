import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { interventionPlanEvaluationSchema } from "@/lib/validations";
import { evaluateInterventionPlan, InterventionPlanError } from "@/lib/intervention-plans";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = interventionPlanEvaluationSchema.parse(await request.json());

    const result = await evaluateInterventionPlan(session.sub, id, data);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof InterventionPlanError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
