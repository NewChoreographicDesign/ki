"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBirthDateInput } from "@/lib/format-birthdate-input";

export function AccountForm() {
  const [currentBirthDate, setCurrentBirthDate] = React.useState("");
  const [newBirthDate, setNewBirthDate] = React.useState("");
  const [confirmBirthDate, setConfirmBirthDate] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const mismatch = newBirthDate.length === 10 && confirmBirthDate.length === 10 && newBirthDate !== confirmBirthDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newBirthDate !== confirmBirthDate) {
      toast.error("Nieuwe geboortedatum komt niet overeen met de bevestiging");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/account/birthdate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentBirthDate, newBirthDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Wijzigen mislukt");
        return;
      }
      toast.success("Geboortedatum gewijzigd — gebruik vanaf nu de nieuwe datum om in te loggen");
      setCurrentBirthDate("");
      setNewBirthDate("");
      setConfirmBirthDate("");
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div>
        <Label htmlFor="currentBirthDate">Huidige geboortedatum</Label>
        <Input
          id="currentBirthDate"
          inputMode="numeric"
          placeholder="DD-MM-JJJJ"
          value={currentBirthDate}
          onChange={(e) => setCurrentBirthDate(formatBirthDateInput(e.target.value))}
          maxLength={10}
          required
        />
      </div>
      <div>
        <Label htmlFor="newBirthDate">Nieuwe geboortedatum</Label>
        <Input
          id="newBirthDate"
          inputMode="numeric"
          placeholder="DD-MM-JJJJ"
          value={newBirthDate}
          onChange={(e) => setNewBirthDate(formatBirthDateInput(e.target.value))}
          maxLength={10}
          required
        />
      </div>
      <div>
        <Label htmlFor="confirmBirthDate">Bevestig nieuwe geboortedatum</Label>
        <Input
          id="confirmBirthDate"
          inputMode="numeric"
          placeholder="DD-MM-JJJJ"
          value={confirmBirthDate}
          onChange={(e) => setConfirmBirthDate(formatBirthDateInput(e.target.value))}
          maxLength={10}
          required
        />
        {mismatch && <p className="mt-1.5 text-sm text-red-400">Komt niet overeen met de nieuwe geboortedatum.</p>}
      </div>
      <Button
        type="submit"
        size="lg"
        loading={loading}
        disabled={currentBirthDate.length !== 10 || newBirthDate.length !== 10 || mismatch}
        className="self-start"
      >
        Wijzigen
      </Button>
    </form>
  );
}
