import ModuloPainel from "@/components/ModuloPainel";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ModuloPainel>{children}</ModuloPainel>;
}
