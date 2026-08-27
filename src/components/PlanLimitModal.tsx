import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  X, 
  ArrowUpRight, 
  Crown, 
  Sparkles, 
  Headphones, 
  ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { getWhatsAppSupportUrl, SUPPORT_PHONE_FORMATTED } from '@/lib/support';

interface PlanLimitModalProps {
  onNavigateToPlans?: () => void;
}

export default function PlanLimitModal({ onNavigateToPlans }: PlanLimitModalProps) {
  const { isOpen, item, details, currentPlanName, closePlanLimitModal } = usePlanLimit();

  if (!isOpen) return null;

  const supportMessage = `Olá! Gostaria de falar com o suporte para fazer um upgrade no meu plano para ter acesso a: ${item}.`;
  const whatsappUrl = getWhatsAppSupportUrl(supportMessage);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closePlanLimitModal}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden z-10"
        >
          {/* Top Accent Header */}
          <div className="bg-neutral-900 text-white p-6 pb-5 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Recurso do Plano</span>
                  <Badge variant="outline" className="text-[10px] bg-white/10 text-white border-white/20 px-2 py-0.5">
                    {currentPlanName}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">Limite do Plano Atingido</h3>
              </div>
            </div>

            <button
              onClick={closePlanLimitModal}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-amber-950 leading-snug">
                  ops! Parece que você não tem acesso a <span className="underline decoration-amber-400 font-bold">{item}</span>.
                </p>
                {details && (
                  <p className="text-xs text-amber-800">
                    {details}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-neutral-700 font-medium">
                Entre em contato com o suporte caso quiser fazer um upgrade no seu plano.
              </p>
              <p className="text-xs text-neutral-500">
                Nossa equipe de atendimento está disponível para liberar recursos adicionais, novos limites de planilhas, notas, membros e automações de IA imediatamente.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closePlanLimitModal}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all"
              >
                <Headphones className="w-4 h-4" />
                <span>Falar com Suporte ({SUPPORT_PHONE_FORMATTED})</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              {onNavigateToPlans && (
                <Button
                  variant="outline"
                  onClick={() => {
                    closePlanLimitModal();
                    onNavigateToPlans();
                  }}
                  className="py-3 px-4 border-neutral-300 font-semibold rounded-xl text-sm hover:bg-neutral-100"
                >
                  <Sparkles className="w-4 h-4 text-amber-500 mr-1.5" />
                  Ver Planos
                </Button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
            <span>Express Tools Hub</span>
            <button 
              onClick={closePlanLimitModal}
              className="text-neutral-600 hover:text-neutral-900 font-medium underline"
            >
              Continuar navegando
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
