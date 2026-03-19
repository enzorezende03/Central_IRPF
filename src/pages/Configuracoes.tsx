import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Bell, Building2, CreditCard } from "lucide-react";

export default function Configuracoes() {
  return (
    <InternalLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <p className="text-sm text-muted-foreground">Gerencie as configurações do sistema</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Dados do Escritório
              </CardTitle>
              <CardDescription>Nome, CNPJ, endereço e dados de contato</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-xs">Em breve</Badge>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Perfis e Permissões
              </CardTitle>
              <CardDescription>Gerencie administradores e operadores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Administrador</span>
                  <span className="text-xs text-muted-foreground">— Acesso total ao sistema</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-3.5 w-3.5 text-info" />
                  <span className="font-medium">Operacional</span>
                  <span className="text-xs text-muted-foreground">— Gerencia demandas e documentos</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">Cliente</span>
                  <span className="text-xs text-muted-foreground">— Acesso apenas ao portal</span>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs mt-3">Em breve</Badge>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notificações
              </CardTitle>
              <CardDescription>Alertas de novas entregas e pendências</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-xs">Em breve</Badge>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Integração de Pagamento
              </CardTitle>
              <CardDescription>Link de pagamento e cobranças automáticas</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-xs">Em breve</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </InternalLayout>
  );
}
