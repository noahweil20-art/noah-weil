import * as React from 'react';
import { cn } from '@/lib/utils';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { ShippingQuote, ShippingOption, Client, Order } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Truck, 
  Package, 
  Search, 
  Plus, 
  Calculator, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  MessageCircle, 
  Copy, 
  ShoppingBag, 
  StickyNote, 
  Trash2, 
  Loader2, 
  Sparkles, 
  FileSpreadsheet, 
  Settings2, 
  Building2, 
  MapPin, 
  ArrowRight, 
  ExternalLink, 
  Layers, 
  DollarSign, 
  Check, 
  SendHorizontal,
  Navigation
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { executeDelete } from '@/lib/deleteHelper';
import { createPostItNote } from '@/lib/postItHelper';
import { motion, AnimatePresence } from 'motion/react';

interface ShippingQuotesProps {
  onNavigateToTab?: (tab: string, preselectedData?: any) => void;
  preselectedClient?: Client | null;
}

interface ShippingSettings {
  defaultOriginCep: string;
  defaultOriginCity: string;
  defaultOriginState: string;
  defaultOriginAddress: string;
  motoboyBaseRate: number;
  motoboyKmRate: number;
  defaultPackagingFee: number;
  defaultMarginPercent: number;
}

const DEFAULT_SETTINGS: ShippingSettings = {
  defaultOriginCep: '01310-100',
  defaultOriginCity: 'São Paulo',
  defaultOriginState: 'SP',
  defaultOriginAddress: 'Av. Paulista, 1000',
  motoboyBaseRate: 15.0,
  motoboyKmRate: 2.5,
  defaultPackagingFee: 5.0,
  defaultMarginPercent: 0
};

export default function ShippingQuotes({ onNavigateToTab, preselectedClient }: ShippingQuotesProps) {
  const { currentWorkspace, canEdit } = useWorkspace();
  const { user } = useUser();

  // State collections
  const [quotes, setQuotes] = React.useState<ShippingQuote[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);

  // Filtering & Search
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'approved' | 'rejected' | 'delivered'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  // UI state
  const [isCreatingQuote, setIsCreatingQuote] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = React.useState<ShippingSettings>(DEFAULT_SETTINGS);

  // Form State for Quote Calculation
  const [quoteForm, setQuoteForm] = React.useState({
    clientId: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    originCep: '',
    originCity: '',
    originState: '',
    originAddress: '',
    destinationCep: '',
    destinationCity: '',
    destinationState: '',
    destinationNeighborhood: '',
    destinationAddress: '',
    weightKg: 1,
    heightCm: 15,
    widthCm: 20,
    lengthCm: 25,
    declaredValue: 150,
    packagingFee: 0,
    marginPercent: 0,
    notes: '',
    autoPostIt: true
  });

  // Handle preselected client from other tabs (like CRM)
  React.useEffect(() => {
    if (preselectedClient) {
      setIsCreatingQuote(true);
      setQuoteForm(prev => ({
        ...prev,
        clientId: preselectedClient.id,
        clientName: preselectedClient.name,
        clientPhone: preselectedClient.phone || '',
        clientEmail: preselectedClient.email || '',
        destinationAddress: preselectedClient.address || ''
      }));

      if (preselectedClient.address) {
        const cepMatch = preselectedClient.address.match(/\d{5}-?\d{3}/);
        if (cepMatch) {
          const foundCep = cepMatch[0];
          setQuoteForm(prev => ({ ...prev, destinationCep: foundCep }));
          fetchAddressByCep(foundCep, false);
        }
      }
    }
  }, [preselectedClient]);

  // Calculated simulation options
  const [calculatedOptions, setCalculatedOptions] = React.useState<ShippingOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = React.useState<string>('sedex');

  // Loading CEP indicator
  const [isSearchingCep, setIsSearchingCep] = React.useState(false);

  // Converting to Order modal state
  const [convertingQuote, setConvertingQuote] = React.useState<ShippingQuote | null>(null);
  const [orderForm, setOrderForm] = React.useState({
    totalProducts: '',
    deadline: '',
    status: 'pending' as Order['status']
  });

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Load Settings from LocalStorage
  React.useEffect(() => {
    if (!currentWorkspace) return;
    const key = `express_shipping_settings_${currentWorkspace.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (_) {}
    }
  }, [currentWorkspace]);

  // Sync default origin when opening form
  React.useEffect(() => {
    if (isCreatingQuote && !quoteForm.originCep) {
      setQuoteForm(prev => ({
        ...prev,
        originCep: settings.defaultOriginCep,
        originCity: settings.defaultOriginCity,
        originState: settings.defaultOriginState,
        originAddress: settings.defaultOriginAddress,
        packagingFee: settings.defaultPackagingFee,
        marginPercent: settings.defaultMarginPercent
      }));
    }
  }, [isCreatingQuote, settings]);

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    const key = `express_shipping_settings_${currentWorkspace.id}`;
    localStorage.setItem(key, JSON.stringify(settings));
    setIsSettingsOpen(false);
    showFeedback('Configurações de frete atualizadas com sucesso!');
  };

  // Listen to Quotes in Firestore
  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'shipping_quotes'),
      where('workspaceId', '==', currentWorkspace.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ShippingQuote[];
      setQuotes(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shipping_quotes');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  // Listen to Clients in Firestore
  React.useEffect(() => {
    if (!currentWorkspace) return;

    const qClients = query(
      collection(db, 'clients'),
      where('workspaceId', '==', currentWorkspace.id)
    );

    const unsubscribe = onSnapshot(qClients, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];
      setClients(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    });

    return () => unsubscribe();
  }, [currentWorkspace]);

  // Cep search via ViaCep
  const fetchAddressByCep = async (cepValue: string, isOrigin: boolean = false) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setIsSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (isOrigin) {
          setQuoteForm(prev => ({
            ...prev,
            originCity: data.localidade || '',
            originState: data.uf || '',
            originAddress: `${data.logradouro || ''}${data.bairro ? ', ' + data.bairro : ''}`
          }));
        } else {
          setQuoteForm(prev => ({
            ...prev,
            destinationCity: data.localidade || '',
            destinationState: data.uf || '',
            destinationNeighborhood: data.bairro || '',
            destinationAddress: data.logradouro || ''
          }));
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar CEP:", err);
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Calculate Shipping Options dynamically based on weight, dimensions, distance/state rules
  React.useEffect(() => {
    const w = Number(quoteForm.weightKg) || 1;
    const h = Number(quoteForm.heightCm) || 15;
    const width = Number(quoteForm.widthCm) || 20;
    const l = Number(quoteForm.lengthCm) || 25;
    const declaredVal = Number(quoteForm.declaredValue) || 0;
    const packFee = Number(quoteForm.packagingFee) || 0;
    const margin = Number(quoteForm.marginPercent) || 0;

    // Cubic weight calculation (A x L x C / 6000)
    const cubicWeight = (h * width * l) / 6000;
    const effectiveWeight = Math.max(w, cubicWeight > 5 ? cubicWeight : w);

    // Is same state / same city?
    const isSameState = quoteForm.originState && quoteForm.destinationState && 
      quoteForm.originState.toUpperCase() === quoteForm.destinationState.toUpperCase();
    const isSameCity = isSameState && quoteForm.originCity && quoteForm.destinationCity && 
      quoteForm.originCity.toLowerCase().trim() === quoteForm.destinationCity.toLowerCase().trim();

    // Base rates calculation formulas
    // 1. SEDEX
    let sedexBase = isSameCity ? 18.50 : isSameState ? 24.90 : 38.50;
    sedexBase += (effectiveWeight - 1) * (isSameState ? 4.50 : 8.20);
    if (declaredVal > 50) sedexBase += declaredVal * 0.01; // Seguro 1%
    const sedexFinal = Math.max(16.90, (sedexBase + packFee) * (1 + margin / 100));

    // 2. PAC
    let pacBase = isSameCity ? 13.90 : isSameState ? 17.80 : 25.40;
    pacBase += (effectiveWeight - 1) * (isSameState ? 3.00 : 5.50);
    if (declaredVal > 50) pacBase += declaredVal * 0.0075; // Seguro 0.75%
    const pacFinal = Math.max(12.50, (pacBase + packFee) * (1 + margin / 100));

    // 3. Motoboy Express (Disponível principalmente se mesma cidade ou mesmo estado)
    let motoboyPrice = settings.motoboyBaseRate + (effectiveWeight > 2 ? (effectiveWeight - 2) * 3 : 0);
    motoboyPrice = (motoboyPrice + packFee) * (1 + margin / 100);

    // 4. Transportadora Rodoviária (Jadlog / Braspress / Total)
    let transpBase = isSameState ? 22.00 : 34.00;
    transpBase += effectiveWeight * (isSameState ? 2.20 : 3.80);
    const transpFinal = (transpBase + packFee + 4.50) * (1 + margin / 100); // GRIS/Pedágio

    // 5. Frota Própria
    const frotaFinal = (isSameCity ? 20.00 : 45.00) + packFee;

    const options: ShippingOption[] = [
      {
        id: 'sedex',
        name: 'SEDEX Express',
        carrier: 'Correios',
        deliveryDays: isSameState ? '1 a 2 dias úteis' : '2 a 4 dias úteis',
        price: Number(sedexFinal.toFixed(2)),
        notes: 'Entrega prioritária com rastreio completo e aviso de entrega.'
      },
      {
        id: 'pac',
        name: 'PAC Econômico',
        carrier: 'Correios',
        deliveryDays: isSameState ? '3 a 6 dias úteis' : '5 a 10 dias úteis',
        price: Number(pacFinal.toFixed(2)),
        notes: 'Opção mais econômica para envio nacional.'
      },
      {
        id: 'motoboy',
        name: 'Motoboy / Entrega Rápida',
        carrier: 'Express Log / Frota Local',
        deliveryDays: isSameCity ? 'Mesmo dia (em até 3h)' : 'Em até 24h',
        price: Number(motoboyPrice.toFixed(2)),
        notes: isSameCity ? 'Entrega direta porta a porta por motoboy credenciado.' : 'Entrega metropolitana.'
      },
      {
        id: 'transp',
        name: 'Transportadora Rodoviária',
        carrier: 'Jadlog / Braspress',
        deliveryDays: isSameState ? '2 a 4 dias úteis' : '4 a 7 dias úteis',
        price: Number(transpFinal.toFixed(2)),
        notes: 'Ideal para caixas maiores ou múltiplos volumes com seguro de carga.'
      },
      {
        id: 'retirada',
        name: 'Retirada no Balcão / Loja',
        carrier: 'Retirada no Local',
        deliveryDays: 'Disponível Imediatamente',
        price: 0.00,
        notes: 'Cliente retira presencialmente no endereço da nossa empresa.'
      }
    ];

    setCalculatedOptions(options);
  }, [
    quoteForm.weightKg, 
    quoteForm.heightCm, 
    quoteForm.widthCm, 
    quoteForm.lengthCm, 
    quoteForm.declaredValue, 
    quoteForm.packagingFee, 
    quoteForm.marginPercent, 
    quoteForm.originState, 
    quoteForm.originCity, 
    quoteForm.destinationState, 
    quoteForm.destinationCity,
    settings
  ]);

  // Handle client selection
  const handleSelectClient = (clientId: string) => {
    const selected = clients.find(c => c.id === clientId);
    if (selected) {
      setQuoteForm(prev => ({
        ...prev,
        clientId: selected.id,
        clientName: selected.name,
        clientPhone: selected.phone || '',
        clientEmail: selected.email || '',
        destinationAddress: selected.address || ''
      }));

      // Extract CEP from address if format 00000-000 exists
      if (selected.address) {
        const cepMatch = selected.address.match(/\d{5}-?\d{3}/);
        if (cepMatch) {
          const foundCep = cepMatch[0];
          setQuoteForm(prev => ({ ...prev, destinationCep: foundCep }));
          fetchAddressByCep(foundCep, false);
        }
      }
    } else {
      setQuoteForm(prev => ({ ...prev, clientId: '' }));
    }
  };

  // Save new Quote to Firestore
  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setActionLoading(true);

    try {
      const selectedOpt = calculatedOptions.find(o => o.id === selectedOptionId) || calculatedOptions[0];
      const quoteCode = `COT-${Math.floor(1000 + Math.random() * 9000)}`;

      const newQuotePayload: Omit<ShippingQuote, 'id'> = {
        code: quoteCode,
        clientName: quoteForm.clientName,
        clientPhone: quoteForm.clientPhone || '',
        clientEmail: quoteForm.clientEmail || '',
        clientId: quoteForm.clientId || '',
        originCep: quoteForm.originCep,
        originCity: quoteForm.originCity || '',
        originState: quoteForm.originState || '',
        originAddress: quoteForm.originAddress || '',
        destinationCep: quoteForm.destinationCep,
        destinationCity: quoteForm.destinationCity || '',
        destinationState: quoteForm.destinationState || '',
        destinationNeighborhood: quoteForm.destinationNeighborhood || '',
        destinationAddress: quoteForm.destinationAddress || '',
        weightKg: Number(quoteForm.weightKg) || 1,
        heightCm: Number(quoteForm.heightCm) || 15,
        widthCm: Number(quoteForm.widthCm) || 20,
        lengthCm: Number(quoteForm.lengthCm) || 25,
        declaredValue: Number(quoteForm.declaredValue) || 0,
        packagingFee: Number(quoteForm.packagingFee) || 0,
        notes: quoteForm.notes || '',
        options: calculatedOptions,
        selectedOption: selectedOpt?.name || 'SEDEX Express',
        totalSelectedPrice: selectedOpt?.price || 0,
        status: 'pending',
        workspaceId: currentWorkspace.id,
        userId: auth.currentUser?.uid,
        ownerId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'shipping_quotes'), newQuotePayload);

      // Auto create Post-it if requested
      if (quoteForm.autoPostIt) {
        const optionsList = calculatedOptions.map(o => `• ${o.name}: R$ ${o.price.toFixed(2)} (${o.deliveryDays})`).join('\n');
        await createPostItNote({
          workspaceId: currentWorkspace.id,
          title: `Frete: ${quoteForm.clientName} (${quoteCode})`,
          content: `🚚 [COTAÇÃO DE FRETE] ${quoteCode}\n👤 Cliente: ${quoteForm.clientName}\n📍 Destino: ${quoteForm.destinationCity || ''}/${quoteForm.destinationState || ''} (CEP ${quoteForm.destinationCep})\n\nOPÇÕES:\n${optionsList}`,
          type: 'order'
        });
      }

      showFeedback(`Cotação ${quoteCode} para "${quoteForm.clientName}" salva com sucesso!`);
      setIsCreatingQuote(false);
      setQuoteForm({
        clientId: '',
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        originCep: settings.defaultOriginCep,
        originCity: settings.defaultOriginCity,
        originState: settings.defaultOriginState,
        originAddress: settings.defaultOriginAddress,
        destinationCep: '',
        destinationCity: '',
        destinationState: '',
        destinationNeighborhood: '',
        destinationAddress: '',
        weightKg: 1,
        heightCm: 15,
        widthCm: 20,
        lengthCm: 25,
        declaredValue: 150,
        packagingFee: settings.defaultPackagingFee,
        marginPercent: settings.defaultMarginPercent,
        notes: '',
        autoPostIt: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shipping_quotes');
    } finally {
      setActionLoading(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (quote: ShippingQuote, newStatus: ShippingQuote['status']) => {
    try {
      await setDoc(doc(db, 'shipping_quotes', quote.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      }, { merge: true });
      showFeedback(`Status da cotação ${quote.code || ''} atualizado para "${newStatus.toUpperCase()}".`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shipping_quotes/${quote.id}`);
    }
  };

  // Format Quote Summary for WhatsApp / Copy
  const buildQuoteText = (q: ShippingQuote) => {
    const dest = `${q.destinationCity || 'Destino'}/${q.destinationState || ''} (CEP ${q.destinationCep})`;
    const optionsText = q.options?.map(o => `📦 *${o.name}* (${o.carrier})\n   ⏱ Prazo: ${o.deliveryDays}\n   💰 Valor: *R$ ${o.price.toFixed(2)}*`).join('\n\n') || '';

    return `Olá *${q.clientName}*! Segue a cotação de envio do seu pedido:\n\n` +
      `📍 *Destino:* ${dest}\n` +
      (q.destinationAddress ? `🏠 *Endereço:* ${q.destinationAddress}\n` : '') +
      `⚖️ *Peso Estimado:* ${q.weightKg} kg (${q.heightCm}x${q.widthCm}x${q.lengthCm} cm)\n\n` +
      `*OPÇÕES DE FRETE E PRAZOS:*\n\n` +
      `${optionsText}\n\n` +
      `Qual das opções você prefere para darmos andamento ao seu pedido? Ficamos à disposição!`;
  };

  const openWhatsAppQuote = (q: ShippingQuote) => {
    if (!q.clientPhone) {
      alert("Este cliente não possui telefone/WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = q.clientPhone.replace(/\D/g, '');
    const num = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const text = buildQuoteText(q);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyQuoteToClipboard = (q: ShippingQuote) => {
    const text = buildQuoteText(q);
    navigator.clipboard.writeText(text);
    setCopiedId(q.id);
    showFeedback('Resumo da cotação copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Convert Quote into Order in Agenda de Pedidos
  const handleConvertQuoteToOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !convertingQuote) return;
    setActionLoading(true);

    try {
      const totalProd = Number(orderForm.totalProducts) || 0;
      const freightVal = convertingQuote.totalSelectedPrice || 0;
      const grandTotal = totalProd + freightVal;
      const deadlineVal = orderForm.deadline || new Date().toISOString().split('T')[0];

      const orderRef = await addDoc(collection(db, 'orders'), {
        customerName: convertingQuote.clientName,
        total: grandTotal,
        status: orderForm.status || 'pending',
        deadline: deadlineVal,
        freightQuoteCode: convertingQuote.code || '',
        freightPrice: freightVal,
        freightOption: convertingQuote.selectedOption || '',
        destinationAddress: convertingQuote.destinationAddress || `${convertingQuote.destinationCity}/${convertingQuote.destinationState}`,
        workspaceId: currentWorkspace.id,
        userId: auth.currentUser?.uid,
        ownerId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });

      // Update quote state to approved with convertedOrderId
      await setDoc(doc(db, 'shipping_quotes', convertingQuote.id), {
        status: 'approved',
        convertedOrderId: orderRef.id,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await createPostItNote({
        workspaceId: currentWorkspace.id,
        title: `Pedido com Frete: ${convertingQuote.clientName}`,
        content: `🎉 [PEDIDO CRIADO COM FRETE]\n👤 Cliente: ${convertingQuote.clientName}\n📦 Frete: ${convertingQuote.selectedOption} (R$ ${freightVal.toFixed(2)})\n💰 Total Geral: R$ ${grandTotal.toFixed(2)}\n📅 Prazo: ${deadlineVal}`,
        type: 'order'
      });

      showFeedback(`Pedido de R$ ${grandTotal.toFixed(2)} (com frete incluso) gerado com sucesso!`);
      setConvertingQuote(null);
      setOrderForm({ totalProducts: '', deadline: '', status: 'pending' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Quote
  const handleDeleteQuote = async (quote: ShippingQuote) => {
    if (!confirm(`Deseja excluir a cotação ${quote.code || ''} de "${quote.clientName}"?`)) return;
    try {
      await executeDelete('shipping_quotes', quote.id);
      showFeedback('Cotação excluída.');
    } catch (err: any) {
      alert('Erro ao excluir: ' + (err.message || 'Erro'));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (quotes.length === 0) {
      alert('Não há cotações salvas para exportar.');
      return;
    }

    const rows = [
      ['Código', 'Cliente', 'Telefone', 'Origem (CEP)', 'Destino (Cidade/UF)', 'Destino (CEP)', 'Peso (kg)', 'Opção Escolhida', 'Valor Frete (R$)', 'Status', 'Data']
    ];

    quotes.forEach(q => {
      rows.push([
        `"${q.code || ''}"`,
        `"${q.clientName || ''}"`,
        `"${q.clientPhone || ''}"`,
        `"${q.originCep || ''}"`,
        `"${q.destinationCity || ''}/${q.destinationState || ''}"`,
        `"${q.destinationCep || ''}"`,
        `"${q.weightKg || 1}"`,
        `"${q.selectedOption || ''}"`,
        `"${(q.totalSelectedPrice || 0).toFixed(2)}"`,
        `"${q.status || 'pending'}"`,
        `"${q.createdAt?.seconds ? format(new Date(q.createdAt.seconds * 1000), 'dd/MM/yyyy') : ''}"`
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cotacoes_frete_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPIs
  const totalApproved = quotes.filter(q => q.status === 'approved').length;
  const totalPending = quotes.filter(q => q.status === 'pending').length;
  const totalDelivered = quotes.filter(q => q.status === 'delivered').length;
  const avgFreight = quotes.length > 0
    ? (quotes.reduce((acc, q) => acc + (q.totalSelectedPrice || 0), 0) / quotes.length)
    : 0;

  // Filtered Quotes List
  const filteredQuotes = quotes.filter(q => {
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    const s = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      (q.code && q.code.toLowerCase().includes(s)) ||
      q.clientName.toLowerCase().includes(s) ||
      (q.destinationCity && q.destinationCity.toLowerCase().includes(s)) ||
      (q.destinationCep && q.destinationCep.includes(s)) ||
      (q.selectedOption && q.selectedOption.toLowerCase().includes(s));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-neutral-900 text-white rounded-xl shadow-md">
              <Truck className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-neutral-900">
                Cotação de Entregas & Frete
              </h2>
              <p className="text-sm text-neutral-500 font-medium">
                Simule custos por CEP e cubagem, compare modalidades (Motoboy, SEDEX, PAC, Transportadora) e envie propostas por WhatsApp.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-xl border-neutral-300 text-xs font-bold gap-1.5 h-10 hover:bg-neutral-50"
            title="Configurar CEP padrão e tarifas base da empresa"
          >
            <Settings2 className="w-4 h-4 text-neutral-600" />
            Tarifas Base
          </Button>

          <Button 
            variant="outline"
            onClick={handleExportCSV}
            className="rounded-xl border-neutral-300 text-xs font-bold gap-1.5 h-10 hover:bg-neutral-50"
            title="Exportar cotações para CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          {canEdit && (
            <Button 
              onClick={() => setIsCreatingQuote(!isCreatingQuote)}
              className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold gap-1.5 h-10 shadow-sm"
            >
              <Calculator className="w-4 h-4 text-amber-400" />
              Nova Cotação
            </Button>
          )}
        </div>
      </div>

      {/* Floating Feedback Alert */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-50 border border-amber-200 text-amber-950 text-sm font-semibold rounded-2xl p-4 flex items-center gap-3 shadow-sm"
          >
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total de Cotações</p>
              <h3 className="text-2xl font-black text-neutral-900">{quotes.length}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Histórico simulado</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Fretes Aprovados</p>
              <h3 className="text-2xl font-black text-emerald-600">{totalApproved}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Aceitos pelos clientes</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Pendentes / Enviadas</p>
              <h3 className="text-2xl font-black text-blue-600">{totalPending}</h3>
              <p className="text-[11px] text-neutral-400 font-medium">Aguardando confirmação</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Frete Médio</p>
              <h3 className="text-2xl font-black text-neutral-900">
                R$ {avgFreight.toFixed(2)}
              </h3>
              <p className="text-[11px] text-neutral-400 font-medium">Ticket médio de envio</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulator & New Quote Form */}
      <AnimatePresence>
        {isCreatingQuote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-2 border-neutral-900 shadow-xl bg-white">
              <CardHeader className="bg-neutral-900 text-white p-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-400" />
                  Calculadora & Simulador de Cotação de Entregas
                </CardTitle>
                <CardDescription className="text-neutral-300 text-xs">
                  Insira o CEP de destino e as dimensões do pacote para comparar modalidades e gerar uma proposta para o cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSaveQuote} className="space-y-6">
                  {/* Client & Destination Selection */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-600" />
                        1. Dados do Cliente e Endereço de Destino
                      </h4>
                      {clients.length > 0 && (
                        <span className="text-[11px] text-neutral-500 font-semibold">
                          💡 Você pode puxar os dados direto da Carteira de Clientes
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {clients.length > 0 && (
                        <div className="space-y-1 md:col-span-3">
                          <label className="text-xs font-bold text-neutral-700">Puxar Cliente da Carteira (Opcional)</label>
                          <select
                            aria-label="Selecionar cliente cadastrado"
                            className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
                            value={quoteForm.clientId}
                            onChange={(e) => handleSelectClient(e.target.value)}
                          >
                            <option value="">-- Selecione para preencher automaticamente ou digite abaixo --</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.company ? `(${c.company})` : ''} - {c.phone || c.email || 'Sem contato'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Nome do Cliente / Destinatário *</label>
                        <Input
                          required
                          placeholder="Ex: Ana Clara Santos"
                          value={quoteForm.clientName}
                          onChange={(e) => setQuoteForm({ ...quoteForm, clientName: e.target.value })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">WhatsApp / Telefone</label>
                        <Input
                          placeholder="(11) 98765-4321"
                          value={quoteForm.clientPhone}
                          onChange={(e) => setQuoteForm({ ...quoteForm, clientPhone: e.target.value })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">E-mail</label>
                        <Input
                          type="email"
                          placeholder="cliente@email.com"
                          value={quoteForm.clientEmail}
                          onChange={(e) => setQuoteForm({ ...quoteForm, clientEmail: e.target.value })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-neutral-200">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                          <span>CEP de Destino *</span>
                          {isSearchingCep && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
                        </label>
                        <Input
                          required
                          placeholder="00000-000"
                          value={quoteForm.destinationCep}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuoteForm({ ...quoteForm, destinationCep: val });
                            if (val.replace(/\D/g, '').length === 8) {
                              fetchAddressByCep(val, false);
                            }
                          }}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Cidade de Destino</label>
                        <Input
                          placeholder="Ex: Curitiba"
                          value={quoteForm.destinationCity}
                          onChange={(e) => setQuoteForm({ ...quoteForm, destinationCity: e.target.value })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">UF / Estado</label>
                        <Input
                          placeholder="PR"
                          maxLength={2}
                          value={quoteForm.destinationState}
                          onChange={(e) => setQuoteForm({ ...quoteForm, destinationState: e.target.value.toUpperCase() })}
                          className="h-10 text-xs rounded-xl uppercase font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Endereço / Bairro</label>
                        <Input
                          placeholder="Rua das Flores, 120"
                          value={quoteForm.destinationAddress}
                          onChange={(e) => setQuoteForm({ ...quoteForm, destinationAddress: e.target.value })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Package Specs & Dimensions */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-blue-600" />
                      2. Dimensões, Peso e Valores da Carga
                    </h4>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Peso Bruto (kg) *</label>
                        <Input
                          required
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={quoteForm.weightKg}
                          onChange={(e) => setQuoteForm({ ...quoteForm, weightKg: Number(e.target.value) })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Altura (cm)</label>
                        <Input
                          type="number"
                          min="1"
                          value={quoteForm.heightCm}
                          onChange={(e) => setQuoteForm({ ...quoteForm, heightCm: Number(e.target.value) })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Largura (cm)</label>
                        <Input
                          type="number"
                          min="1"
                          value={quoteForm.widthCm}
                          onChange={(e) => setQuoteForm({ ...quoteForm, widthCm: Number(e.target.value) })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Comprimento (cm)</label>
                        <Input
                          type="number"
                          min="1"
                          value={quoteForm.lengthCm}
                          onChange={(e) => setQuoteForm({ ...quoteForm, lengthCm: Number(e.target.value) })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-neutral-200">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Valor Declarado dos Produtos (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="150.00"
                          value={quoteForm.declaredValue}
                          onChange={(e) => setQuoteForm({ ...quoteForm, declaredValue: Number(e.target.value) })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Taxa de Embalagem / Manuseio (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="5.00"
                          value={quoteForm.packagingFee}
                          onChange={(e) => setQuoteForm({ ...quoteForm, packagingFee: Number(e.target.value) })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-700">Margem Adicional de Frete (%)</label>
                        <Input
                          type="number"
                          step="1"
                          placeholder="0"
                          value={quoteForm.marginPercent}
                          onChange={(e) => setQuoteForm({ ...quoteForm, marginPercent: Number(e.target.value) })}
                          className="h-10 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated Shipping Options Comparison Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-emerald-600" />
                        3. Modalidades de Envio Calculadas (Selecione a padrão para a cotação)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {calculatedOptions.map(opt => {
                        const isSelected = selectedOptionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            onClick={() => setSelectedOptionId(opt.id)}
                            className={cn(
                              "p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between text-left",
                              isSelected 
                                ? "border-neutral-900 bg-neutral-900 text-white shadow-md" 
                                : "border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50/50"
                            )}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                                  isSelected ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-700"
                                )}>
                                  {opt.carrier}
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                              </div>

                              <div>
                                <h5 className={cn("font-black text-sm", isSelected ? "text-white" : "text-neutral-900")}>
                                  {opt.name}
                                </h5>
                                <p className={cn("text-xs font-semibold mt-0.5", isSelected ? "text-amber-300" : "text-emerald-700")}>
                                  ⏱ Prazo: {opt.deliveryDays}
                                </p>
                              </div>

                              <p className={cn("text-[11px] leading-relaxed", isSelected ? "text-neutral-300" : "text-neutral-500")}>
                                {opt.notes}
                              </p>
                            </div>

                            <div className="pt-3 mt-3 border-t border-current/10 flex items-center justify-between">
                              <span className="text-[11px] opacity-75 font-semibold">Valor Final</span>
                              <span className={cn("text-lg font-black", isSelected ? "text-amber-400" : "text-neutral-900")}>
                                {opt.price === 0 ? 'Grátis' : `R$ ${opt.price.toFixed(2)}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes & Auto Post-it */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-700">Observações Internas (Opcional)</label>
                    <Input
                      placeholder="Ex: Carga frágil, embalar com plástico bolha duplo..."
                      value={quoteForm.notes}
                      onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-neutral-100">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700 select-none">
                      <input
                        type="checkbox"
                        checked={quoteForm.autoPostIt}
                        onChange={(e) => setQuoteForm({ ...quoteForm, autoPostIt: e.target.checked })}
                        className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 h-4 w-4"
                      />
                      <span>📌 Gerar anotação da cotação no mural de Post-its</span>
                    </label>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsCreatingQuote(false)}
                        className="rounded-xl h-10 text-xs font-bold"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={actionLoading}
                        className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl h-10 text-xs font-bold px-6 shadow-sm"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Cotação de Frete'}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Company Base Settings */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-neutral-200"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-neutral-900">
                  <Settings2 className="w-5 h-5 text-amber-600" />
                  <h3 className="font-bold text-base">Tarifas Base & Origem da Empresa</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(false)} className="rounded-full">
                  ✕
                </Button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-neutral-700">CEP Padrão de Origem da Loja/Estoque</label>
                  <Input
                    required
                    value={settings.defaultOriginCep}
                    onChange={(e) => setSettings({ ...settings, defaultOriginCep: e.target.value })}
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-neutral-700">Cidade de Origem</label>
                    <Input
                      value={settings.defaultOriginCity}
                      onChange={(e) => setSettings({ ...settings, defaultOriginCity: e.target.value })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-neutral-700">UF / Estado</label>
                    <Input
                      maxLength={2}
                      value={settings.defaultOriginState}
                      onChange={(e) => setSettings({ ...settings, defaultOriginState: e.target.value.toUpperCase() })}
                      className="h-10 text-xs rounded-xl uppercase font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-neutral-700">Taxa Base de Motoboy (R$)</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={settings.motoboyBaseRate}
                      onChange={(e) => setSettings({ ...settings, motoboyBaseRate: Number(e.target.value) })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-neutral-700">Taxa de Embalagem Padrão (R$)</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={settings.defaultPackagingFee}
                      onChange={(e) => setSettings({ ...settings, defaultPackagingFee: Number(e.target.value) })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t">
                  <Button type="button" variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-xl h-10 text-xs font-bold">
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl h-10 text-xs font-bold px-5">
                    Salvar Configurações
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Convert Quote into Order */}
      <AnimatePresence>
        {convertingQuote && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-neutral-200"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2 text-purple-700">
                  <ShoppingBag className="w-6 h-6" />
                  <h3 className="font-bold text-lg">Criar Pedido com Frete Cotado</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setConvertingQuote(null)} className="rounded-full">
                  ✕
                </Button>
              </div>

              <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-xs space-y-1.5 text-purple-950">
                <p className="font-bold text-sm">Cliente: {convertingQuote.clientName}</p>
                <div className="flex items-center justify-between text-xs font-semibold text-purple-800">
                  <span>Modalidade: <strong>{convertingQuote.selectedOption}</strong></span>
                  <span>Frete: <strong>R$ {(convertingQuote.totalSelectedPrice || 0).toFixed(2)}</strong></span>
                </div>
                <p className="text-purple-700 text-[11px]">
                  Destino: {convertingQuote.destinationCity}/{convertingQuote.destinationState} ({convertingQuote.destinationAddress || 'Endereço'})
                </p>
              </div>

              <form onSubmit={handleConvertQuoteToOrder} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-700">Valor dos Produtos (sem o frete) *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={orderForm.totalProducts}
                    onChange={(e) => setOrderForm({ ...orderForm, totalProducts: e.target.value })}
                    className="h-11 text-base font-bold rounded-xl"
                  />
                  <p className="text-[11px] text-neutral-500">
                    O frete de <strong>R$ {(convertingQuote.totalSelectedPrice || 0).toFixed(2)}</strong> será somado automaticamente ao total final do pedido.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Prazo de Entrega do Pedido *</label>
                    <Input
                      required
                      type="date"
                      value={orderForm.deadline}
                      onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700">Status Inicial</label>
                    <select
                      aria-label="Status inicial do pedido"
                      className="w-full h-10 px-3 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                      value={orderForm.status}
                      onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value as any })}
                    >
                      <option value="pending">🟡 Pendente</option>
                      <option value="shipped">🔵 Enviado / Em Transporte</option>
                      <option value="delivered">🟢 Entregue</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t">
                  <Button type="button" variant="ghost" onClick={() => setConvertingQuote(null)} className="rounded-xl h-10 text-xs font-bold">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={actionLoading} className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl h-10 text-xs font-bold px-5 gap-2">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar Pedido na Agenda
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
          <Input
            placeholder="Buscar por código, cliente, CEP ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl border-neutral-200"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="rounded-xl text-xs font-bold h-9"
          >
            Todas ({quotes.length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
            className={cn("rounded-xl text-xs font-bold h-9", statusFilter === 'pending' && "bg-blue-600 hover:bg-blue-700")}
          >
            Pendentes ({totalPending})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('approved')}
            className={cn("rounded-xl text-xs font-bold h-9", statusFilter === 'approved' && "bg-emerald-600 hover:bg-emerald-700")}
          >
            Aprovadas ({totalApproved})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'delivered' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('delivered')}
            className={cn("rounded-xl text-xs font-bold h-9", statusFilter === 'delivered' && "bg-purple-600 hover:bg-purple-700")}
          >
            Entregues ({totalDelivered})
          </Button>
        </div>
      </div>

      {/* Quotes Cards Grid */}
      {filteredQuotes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-neutral-200">
          <Truck className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-neutral-800">Nenhuma cotação de frete encontrada</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || statusFilter !== 'all' 
              ? 'Tente ajustar os filtros ou os termos de busca.' 
              : 'Faça sua primeira simulação de frete para comparar preços e enviar propostas para clientes.'}
          </p>
          {canEdit && !searchTerm && statusFilter === 'all' && (
            <Button
              onClick={() => setIsCreatingQuote(true)}
              className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold h-9"
            >
              <Calculator className="w-4 h-4 mr-1.5 text-amber-400" />
              Simular Primeira Cotação
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredQuotes.map((quote) => {
            const isApproved = quote.status === 'approved';
            const isDelivered = quote.status === 'delivered';
            const isRejected = quote.status === 'rejected';

            return (
              <Card 
                key={quote.id} 
                className="border-neutral-200/80 hover:border-neutral-400 hover:shadow-md transition-all rounded-2xl flex flex-col justify-between overflow-hidden bg-white group"
              >
                <div>
                  <div className="p-5 border-b border-neutral-100 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {quote.code || 'COT'}
                        </span>
                        <h4 className="font-black text-neutral-900 text-base group-hover:text-amber-600 transition-colors">
                          {quote.clientName}
                        </h4>
                      </div>
                      <p className="text-xs text-neutral-500 font-semibold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        {quote.destinationCity}/{quote.destinationState} (CEP {quote.destinationCep})
                      </p>
                    </div>

                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border",
                        isApproved && "bg-emerald-50 text-emerald-800 border-emerald-300",
                        isDelivered && "bg-purple-50 text-purple-800 border-purple-300",
                        isRejected && "bg-red-50 text-red-800 border-red-300",
                        !isApproved && !isDelivered && !isRejected && "bg-blue-50 text-blue-800 border-blue-300"
                      )}
                    >
                      {isApproved ? '🟢 Aprovada' : isDelivered ? '📦 Entregue' : isRejected ? '🔴 Rejeitada' : '🔵 Enviada'}
                    </Badge>
                  </div>

                  <div className="p-5 space-y-3.5 text-xs">
                    {/* Selected modal preview */}
                    <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-neutral-400">Modalidade Selecionada</p>
                        <p className="font-black text-neutral-900 text-xs">{quote.selectedOption || 'SEDEX'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-neutral-400">Valor Frete</p>
                        <p className="text-base font-black text-emerald-600">
                          R$ {(quote.totalSelectedPrice || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Weight & dimensions */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600 font-medium bg-white p-2.5 rounded-xl border border-neutral-100">
                      <span>⚖️ Peso: <strong>{quote.weightKg} kg</strong></span>
                      <span>📏 <strong>{quote.heightCm}x{quote.widthCm}x{quote.lengthCm} cm</strong></span>
                    </div>

                    {/* Options list breakdown */}
                    {quote.options && quote.options.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                          Outras Opções Calculadas:
                        </p>
                        <div className="space-y-1">
                          {quote.options.map(opt => (
                            <div key={opt.id} className="flex items-center justify-between text-[11px] text-neutral-600">
                              <span>• {opt.name} ({opt.deliveryDays})</span>
                              <span className="font-bold text-neutral-900">
                                {opt.price === 0 ? 'Grátis' : `R$ ${opt.price.toFixed(2)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {quote.notes && (
                      <p className="text-[11px] text-neutral-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                        "{quote.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-neutral-50/80 border-t border-neutral-100 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    {quote.clientPhone && (
                      <Button
                        size="sm"
                        onClick={() => openWhatsAppQuote(quote)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-8 flex-1 gap-1.5 shadow-sm"
                        title="Enviar orçamento formatado no WhatsApp do cliente"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyQuoteToClipboard(quote)}
                      className="rounded-xl border-neutral-300 text-xs font-bold h-8 gap-1"
                      title="Copiar texto da cotação"
                    >
                      {copiedId === quote.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-600" />}
                      Copiar
                    </Button>

                    {canEdit && !isApproved && (
                      <Button
                        size="sm"
                        onClick={() => setConvertingQuote(quote)}
                        className="bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold h-8 gap-1"
                        title="Converter cotação em um Pedido"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Pedido
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200/50">
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateStatus(quote, isApproved ? 'pending' : 'approved')}
                            className="h-7 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg px-2"
                          >
                            {isApproved ? 'Desmarcar Aprovação' : 'Aprovar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateStatus(quote, isDelivered ? 'pending' : 'delivered')}
                            className="h-7 text-[11px] font-bold text-purple-700 hover:bg-purple-50 rounded-lg px-2"
                          >
                            {isDelivered ? 'Pendente' : 'Entregue'}
                          </Button>
                        </>
                      )}
                    </div>

                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteQuote(quote)}
                        className="h-7 w-7 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                        title="Excluir cotação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
