import { FileUp } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

/** Page-header action linking to /import (Transactions, Accounts). */
export function ImportStatementLink({ className }: { className?: string }) {
  return (
    <Link href="/import" className={buttonClasses("secondary", "md", className)}>
      <FileUp aria-hidden /> Import statement
    </Link>
  );
}
