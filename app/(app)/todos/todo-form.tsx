"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function TodoForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Toevoegen mislukt");
        return;
      }
      toast.success("Taak toegevoegd");
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      router.refresh();
    } catch {
      toast.error("Er is iets misgegaan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="title">Taak</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="priority">Prioriteit</Label>
          <Select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
          >
            <option value="LOW">Laag</option>
            <option value="MEDIUM">Gemiddeld</option>
            <option value="HIGH">Hoog</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="description">Omschrijving (optioneel)</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <Button type="submit" size="lg" disabled={loading || !title} className="self-start">
        {loading ? "Toevoegen..." : "Toevoegen"}
      </Button>
    </form>
  );
}
