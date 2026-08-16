import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Control } from "react-hook-form";
import type { SettingsFormValues } from "@/components/settings-form";

/** J2b.9 (invoice-design.md §1.4) — the six invoice settings DDL-3
 * added to SETTING_KEYS. */
export function InvoiceSettingsFields({ control }: { control: Control<SettingsFormValues> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="invoicePaymentTermDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Betalingstermijn (dagen)</FormLabel>
              <FormControl><Input type="number" min={0} {...field} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="btwRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>BTW-tarief (%)</FormLabel>
              <FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl>
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="invoiceBankAccountHolder"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rekeninghouder (IBAN)</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="invoiceNumberFormat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Factuurnummerformaat</FormLabel>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="defaultDepositPercentage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Standaard voorschot (%)</FormLabel>
              <FormControl><Input type="number" step="0.01" min={0} max={100} {...field} /></FormControl>
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="invoiceFooter"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Voettekst op facturen</FormLabel>
            <FormControl><Textarea rows={2} {...field} /></FormControl>
          </FormItem>
        )}
      />
    </>
  );
}
