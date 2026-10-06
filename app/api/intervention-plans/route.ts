import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { createInterventionPlanSchema } from "@/lib/validations";
import { createInterventionPlan, InterventionPlanError } from "@/lib/intervention-plans";

// Open to every role, same accessibility as POST /api/interventions itself
// (see that route's own comment) — a plan is a richer follow-up on an
// intervention any staff member can already create.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const data = createInterventionPlanSchema.parse(await request.json());

    const plan = await createInterventionPlan(session.sub, data);

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    if (error instanceof InterventionPlanError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error);
  }
}
