import * as React from 'react';
import { ShieldAlert, LogOut, MessageSquare, ExternalLink, Headphones } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { logout, auth } from '@/lib/firebase';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';

export default function SuspendedView() {
  const supportUrl = getWhatsAppSupportUrl(
    `Olá! Minha conta (${auth.currentUser?.email || 'usuário'}) foi suspensa no Express Tools e gostaria de solicitar esclarecimentos e reativação.`
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      <Card className="max-w-md w-full border-none shadow-2xl overflow-hidden bg-white">
        <div className="h-2 bg-red-600" />
        <CardHeader className="text-center p-8 pb-4">
          <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-6 shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <CardTitle className="text-3xl font-black italic serif uppercase text-neutral-900 tracking-tight">
            Acesso Suspenso
          </CardTitle>
          <CardDescription className="text-neutral-500 font-medium text-base mt-2">
            Sua conta foi temporariamente desativada por um administrador do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-6">
          <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 space-y-3">
            <h4 className="text-sm font-black text-neutral-900 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-red-600" />
              O que fazer?
            </h4>
            <p className="text-sm text-neutral-600 font-medium leading-relaxed">
              Para reativar sua conta ou obter mais informações sobre o motivo da suspensão, entre em contato com o suporte através do WhatsApp <strong className="font-bold text-neutral-900">{SUPPORT_PHONE_FORMATTED}</strong>.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xl shadow-emerald-900/20 transition-all text-sm gap-2"
            >
              <Headphones className="w-4 h-4" />
              <span>Contatar Suporte no WhatsApp ({SUPPORT_PHONE_FORMATTED})</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            <Button variant="ghost" className="w-full h-12 rounded-xl font-bold text-neutral-500" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair da Conta
            </Button>
          </div>
        </CardContent>
        <div className="p-6 bg-neutral-50 border-t flex justify-center">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">Express Tools Security System</p>
        </div>
      </Card>
    </div>
  );
}
