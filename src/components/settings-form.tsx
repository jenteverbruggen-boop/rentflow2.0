"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CompanySettingsFields } from "@/components/company-settings-fields";
import { InvoiceSettingsFields } from "@/components/invoice-settings-fields";

const schema = z.object({
  companyName: z.string().optional(),
  companyAddress: z.string().optional(),
  companyPostalCode: z.string().optional(),
  companyCity: z.string().optional(),
  companyPhone: z.string().optional(),
  companyVat: z.string().optional(),
  companyIban: z.string().optional(),
  // J2b.9 (DDL-3, invoice-design.md §1.4)
  invoicePaymentTermDays: z.string().optional(),
  invoiceBankAccountHolder: z.string().optional(),
  invoiceNumberFormat: z.string().optional(),
  invoiceFooter: z.string().optional(),
  btwRate: z.string().optional(),
  defaultDepositPercentage: z.string().optional(),
});

export type SettingsFormValues = z.infer<typeof schema>;

/** J2b.9 — split into company-settings-fields.tsx +
 * invoice-settings-fields.tsx (both ~90 lines) once the six new
 * invoice settings pushed this file over the 150-line limit; this
 * wrapper just owns the query/mutation/form plumbing. */
export function SettingsForm() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  useEffect(() => {
    if (settings) form.reset(settings as SettingsFormValues);
  }, [settings, form]);

  const save = useMutation({
    mutationFn: (values: SettingsFormValues) =>
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instellingen</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Bedrijfsgegevens</h3>
              <CompanySettingsFields control={form.control} />
            </div>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Facturatie</h3>
              <InvoiceSettingsFields control={form.control} />
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Opslaan..." : "Opslaan"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
