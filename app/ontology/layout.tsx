import OntologyShell from "@/app/ontology/shell";

// Wraps every /ontology/* surface in the exe-only workspace shell.
// Web mode renders children unchanged.
export default function OntologyLayout({ children }: { children: React.ReactNode }) {
  return <OntologyShell>{children}</OntologyShell>;
}
