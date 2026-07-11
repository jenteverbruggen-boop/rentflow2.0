import { NextRequest } from "next/server";
import { notFound } from "@/lib/api-auth";

// Public registration disabled (F1): admin creates accounts via /users
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  return notFound();
}
