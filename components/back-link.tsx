import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";

interface BackLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function BackLink({ href, children, className = "" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`link-primary inline-flex items-center gap-1 ${className}`}
    >
      <ArrowLeftIcon className="w-4 h-4" />
      {children}
    </Link>
  );
}
