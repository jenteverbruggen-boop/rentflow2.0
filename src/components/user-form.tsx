"use client";

import { UserFormCreate, type CreateUserValues } from "@/components/user-form-create";
import { UserFormEdit, type EditUserValues } from "@/components/user-form-edit";
import type { User } from "@/types";

export type { CreateUserValues, EditUserValues };

interface BaseProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
}
interface CreateProps extends BaseProps {
  mode: "create";
  onSubmit: (v: CreateUserValues) => void;
}
interface EditProps extends BaseProps {
  mode: "edit";
  defaultValues: User;
  onSubmit: (v: EditUserValues) => void;
}
type Props = CreateProps | EditProps;

/** Was a single 247-line file with a hardcoded role dropdown; now a thin
 * mode switch over the two split dialogs (N1.5). */
export function UserForm(props: Props) {
  if (props.mode === "edit") {
    return (
      <UserFormEdit
        open={props.open}
        onOpenChange={props.onOpenChange}
        defaultValues={props.defaultValues}
        onSubmit={props.onSubmit}
        isPending={props.isPending}
      />
    );
  }
  return (
    <UserFormCreate
      open={props.open}
      onOpenChange={props.onOpenChange}
      onSubmit={props.onSubmit}
      isPending={props.isPending}
    />
  );
}
