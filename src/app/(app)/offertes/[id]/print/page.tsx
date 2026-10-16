"use client";

import { useParams } from "next/navigation";
import { InvoicePrintView } from "@/components/print/invoice-print-view";

export default function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  return <InvoicePrintView id={id} />;
}
