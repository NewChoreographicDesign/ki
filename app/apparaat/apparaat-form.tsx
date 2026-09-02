"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApparaatForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [passcode, setPasscode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/device/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Onjuist wachtwoord");
        return;
      }
      toast.success("Apparaat vrijgegeven");
      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan, probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="passcode">Apparaat-wachtwoord</Label>
        <Input
          id="passcode"
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          required
          autoFocus
        />
      </div>
      <Button type="submit" size="lg" disabled={loading || !passcode} className="w-full">
        {loading ? "Bezig..." : "Vrijgeven"}
      </Button>
    </form>
  );
}
