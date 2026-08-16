import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Control } from "react-hook-form";
import type { SettingsFormValues } from "@/components/settings-form";

/** J2b.9 — the 7 fields settings-form.tsx originally had inline,
 * extracted to stay under the 150-line limit once invoice settings
 * (invoice-settings-fields.tsx) were added alongside them. Pure move,
 * no behaviour change. */
export function CompanySettingsFields({ control }: { control: Control<SettingsFormValues> }) {
  return (
    <>
      <FormField
        control={control}
        name="companyName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bedrijfsnaam</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="companyAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Adres</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="companyPostalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Postcode</FormLabel>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="companyCity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gemeente</FormLabel>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="companyPhone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Telefoon</FormLabel>
            <FormControl><Input {...field} /></FormControl>
          </FormItem>
        )}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name="companyVat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>BTW-nummer</FormLabel>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="companyIban"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IBAN</FormLabel>
              <FormControl><Input {...field} /></FormControl>
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
