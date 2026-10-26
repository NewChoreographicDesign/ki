"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDateTime } from "@/lib/utils";
import type { HandoverDigest } from "@/lib/handover-shared";

const TONE = { red: "bg-red-500", amber: "bg-amber-400", slate: "bg-slate-500" } as const;

export function HandoverDigestPanel({ digest, canPrint }: { digest: HandoverDigest; canPrint: boolean }) {
  const filled = digest.sections.filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Automatisch samengesteld uit de actuele gegevens · {formatDateTime(new Date(digest.generatedAt))}</p>
        {canPrint && (
          <Button size="sm" variant="ghost" onClick={() => window.print()} aria-label="Afdrukken">
            <Printer className="h-4 w-4" />
          </Button>
        )}
      </div>

      {filled.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Alles rustig" description="Er zijn geen openstaande punten voor de volgende dienst." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filled.map((section) => (
            <Card key={section.key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-500" /> {section.title}
                  </span>
                  <Badge variant={section.items.some((i) => i.tone === "red") ? "red" : section.items.some((i) => i.tone === "amber") ? "amber" : "slate"}>{section.total}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface2">
                        <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE[item.tone])} />
                        <span className="min-w-0 text-sm">
                          {item.subject && <span className="mr-1.5 font-medium text-slate-200">{item.subject}</span>}
                          <span className="text-slate-300">{item.text}</span>
                          {item.detail && <span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                  {section.total > section.items.length && <li className="px-2 pt-1 text-xs text-slate-500">+ {section.total - section.items.length} meer</li>}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
