import Link from "next/link";

type BracketLinkProps = {
  href: string;
  children: string;
  external?: boolean;
};

export function BracketLink({ href, children, external }: BracketLinkProps) {
  const label = `[ ${children.toUpperCase()} ]`;

  if (external) {
    return (
      <a className="pds-bracket-link" href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  return (
    <Link className="pds-bracket-link" href={href}>
      {label}
    </Link>
  );
}
