// All routes render inside the shared AppShell (see components/AppShell and
// app/nav-gate). This wrapper stays as a passthrough so /ontology/* keeps a
// stable layout boundary without a second sidebar.
export default function OntologyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
