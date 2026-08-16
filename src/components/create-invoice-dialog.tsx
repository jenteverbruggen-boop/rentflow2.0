"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useInvoices } from "@/hooks/use-invoices";
import type { InvoiceRole, DepositType } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: number;
}

/** J2b.7 — role picker (deposit/final/standalone) + deposit type/value
 * fields; posts /api/invoices and redirects to the new draft's detail
 * page. */
export function CreateInvoiceDialog({ open, onOpenChange, projectId }: Props) {
  const router = useRouter();
  const { create } = useInvoices();
  const [role, setRole] = useState<InvoiceRole>("standalone");
  const [depositType, setDepositType] = useState<DepositType>("percentage");
  const [depositValue, setDepositValue] = useState("30");

  function submit() {
    create.mutate(
      {
        projectId,
        invoiceRole: role,
        ...(role === "deposit" ? { depositType, depositValue: Number(depositValue) } : {}),
      },
      {
        onSuccess: (invoice) => {
          onOpenChange(false);
          router.push(`/facturen/${invoice.id}`);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nieuwe factuur</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={role} onValueChange={(v) => setRole(v as InvoiceRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standalone">Volledige factuur</SelectItem>
                <SelectItem value="deposit">Voorschotfactuur</SelectItem>
                <SelectItem value="final">Eindfactuur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "deposit" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type voorschot</Label>
                <Select value={depositType} onValueChange={(v) => setDepositType(v as DepositType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Vast bedrag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{depositType === "percentage" ? "Percentage (%)" : "Bedrag excl. BTW (€)"}</Label>
                <Input type="number" step="0.01" value={depositValue} onChange={(e) => setDepositValue(e.target.value)} />
              </div>
            </div>
          )}
          {create.isError && <p className="text-xs text-destructive">{create.error.message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
            <Button type="button" disabled={create.isPending} onClick={submit}>Aanmaken</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
