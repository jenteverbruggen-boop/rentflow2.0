"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface CompanyInfo {
  companyName?: string;
  companyAddress?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyPhone?: string;
  companyVat?: string;
  companyIban?: string;
}

interface DocumentHeaderProps {
  meta: {
    opdrachtgever?: string | null;
    // J2a — the client billing block: address + VAT, not just the name.
    // Optional so pakbon/callsheet (which never pass these) are unaffected.
    opdrachtgeverAdres?: string | null;
    opdrachtgeverVat?: string | null;
    locatie?: string | null;
    locatieAdres?: string | null;
    projectnummer?: number;
    accountmanager?: string;
    aangemaaktOp?: string;
  };
}

export function DocumentHeader({ meta }: DocumentHeaderProps) {
  const [company, setCompany] = useState<CompanyInfo>({});
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setCompany)
      .catch(() => {});
  }, []);

  return (
    <div className="flex justify-between items-start mb-6 gap-4">
      <div className="space-y-0.5">
        {!logoError ? (
          <Image
            src="/api/settings/logo"
            alt="Logo"
            width={224}
            height={56}
            unoptimized
            className="h-14 object-contain mb-2"
            onError={() => setLogoError(true)}
          />
        ) : company.companyName ? (
          <p className="text-xl font-bold">{company.companyName}</p>
        ) : null}
        {company.companyAddress && (
          <p className="text-sm">{company.companyAddress}</p>
        )}
        {(company.companyPostalCode || company.companyCity) && (
          <p className="text-sm">
            {[company.companyPostalCode, company.companyCity]
              .filter(Boolean)
              .join(" ")}
          </p>
        )}
        {company.companyPhone && (
          <p className="text-sm">{company.companyPhone}</p>
        )}
        {company.companyVat && (
          <p className="text-sm">BTW: {company.companyVat}</p>
        )}
        {company.companyIban && (
          <p className="text-sm">IBAN: {company.companyIban}</p>
        )}
      </div>
      <div className="text-right space-y-1 text-sm">
        {meta.opdrachtgever && (
          <p>
            <span className="font-medium">Opdrachtgever:</span>{" "}
            {meta.opdrachtgever}
          </p>
        )}
        {meta.opdrachtgeverAdres && (
          <p className="text-xs text-muted-foreground">{meta.opdrachtgeverAdres}</p>
        )}
        {meta.opdrachtgeverVat && (
          <p className="text-xs text-muted-foreground">BTW: {meta.opdrachtgeverVat}</p>
        )}
        {meta.locatie && (
          <p>
            <span className="font-medium">Locatie:</span> {meta.locatie}
          </p>
        )}
        {meta.locatieAdres && (
          <p className="text-xs text-muted-foreground">{meta.locatieAdres}</p>
        )}
        {meta.projectnummer && (
          <p>
            <span className="font-medium">Projectnummer:</span>{" "}
            {meta.projectnummer}
          </p>
        )}
        {meta.accountmanager && (
          <p>
            <span className="font-medium">Accountmanager:</span>{" "}
            {meta.accountmanager}
          </p>
        )}
        {meta.aangemaaktOp && (
          <p>
            <span className="font-medium">Aangemaakt:</span> {meta.aangemaaktOp}
          </p>
        )}
      </div>
    </div>
  );
}
