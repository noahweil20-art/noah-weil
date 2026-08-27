import * as React from 'react';
import { 
  Table as TableIcon, 
  Plus, 
  Trash2, 
  Save, 
  FileSpreadsheet,
  ChevronLeft,
  Loader2,
  Download,
  Zap,
  Image as ImageIcon,
  Type,
  Palette,
  Eraser,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
  X
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Spreadsheet } from '@/types';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useUser } from '@/contexts/UserContext';
import { usePlanLimit } from '@/contexts/PlanLimitContext';
import { executeDelete } from '@/lib/deleteHelper';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export default function SpreadsheetArea() {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const { user, plan } = useUser();
  const { checkLimit } = usePlanLimit();
  const [spreadsheets, setSpreadsheets] = React.useState<Spreadsheet[]>([]);
  const [currentSheet, setCurrentSheet] = React.useState<Spreadsheet | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);

  // Active cell & insertion popups
  const [activeCell, setActiveCell] = React.useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [showColPopup, setShowColPopup] = React.useState(false);
  const [showRowPopup, setShowRowPopup] = React.useState(false);

  const spreadsheetEnabled = plan?.permissions.spreadsheetEnabled ?? true;
  const maxSpreadsheets = plan?.permissions.spreadsheetMaxSheets || 3;
  const maxRows = plan?.permissions.spreadsheetMaxRows || 100;
  const maxCols = plan?.permissions.spreadsheetMaxColumns || 15;
  const exportEnabled = plan?.permissions.spreadsheetExportEnabled;
  const realtimeCollaboration = plan?.permissions.spreadsheetRealtimeCollaboration;
  const advancedStyles = plan?.permissions.spreadsheetAdvancedStyles;
  const imageUploadEnabled = plan?.permissions.spreadsheetImageUploadEnabled;

  React.useEffect(() => {
    if (!currentWorkspace) return;

    setLoading(true);
    const q = query(collection(db, 'spreadsheets'), where('workspaceId', '==', currentWorkspace.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawData = doc.data();
        let parsedData = rawData.data;
        if (typeof rawData.data === 'string') {
          try {
            parsedData = JSON.parse(rawData.data);
          } catch (e) {
            console.error('Error parsing spreadsheet data:', e);
            parsedData = [];
          }
        }
        return { ...rawData, id: doc.id, data: parsedData } as Spreadsheet;
      });
      setSpreadsheets(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'spreadsheets'));

    return () => unsubscribe();
  }, [currentWorkspace]);
  
  // Realtime Collaboration Sync
  React.useEffect(() => {
    if (!currentSheet || !realtimeCollaboration) return;
    const updatedSheet = spreadsheets.find(s => s.id === currentSheet.id);
    if (updatedSheet && JSON.stringify(updatedSheet.data) !== JSON.stringify(currentSheet.data)) {
      setCurrentSheet(updatedSheet);
    }
  }, [spreadsheets, realtimeCollaboration]);

  const handleCreate = async () => {
    if (!currentWorkspace || !user) return;
    
    if (!checkLimit('ao recurso de planilhas', spreadsheetEnabled)) {
      return;
    }

    if (!checkLimit(`criar novas planilhas (limite de ${maxSpreadsheets} planilhas atingido no seu plano)`, spreadsheets.length < maxSpreadsheets)) {
      return;
    }

    setSaving(true);
    // Use smaller initial data to avoid potential Firestore size limits or timeout issues on creation
    const initialRows = Math.min(20, maxRows);
    const initialCols = Math.min(10, maxCols);
    const emptyData = Array(initialRows).fill(null).map(() => Array(initialCols).fill(''));
    
    try {
      await addDoc(collection(db, 'spreadsheets'), {
        name: `Nova Planilha ${spreadsheets.length + 1}`,
        workspaceId: currentWorkspace.id,
        ownerId: user.uid,
        userId: user.uid, // Maintain compatibility with existing rules
        data: JSON.stringify(emptyData),
        updatedBy: user.displayName || user.email,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setSaving(false);
    } catch (e: any) {
      console.error("Error creating spreadsheet:", e);
      setSaving(false);
      alert('Erro ao criar planilha: ' + (e.message.includes('permission') ? 'Permissão negada no Firestore.' : e.message));
    }
  };

  const handleDelete = async (sheet: Spreadsheet, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDeleting(sheet.id);
    try {
      await executeDelete('spreadsheets', sheet.id);
      if (currentSheet?.id === sheet.id) setCurrentSheet(null);
      setIsDeleting(null);
    } catch (e: any) {
      console.error("[DELETE] Erro ao excluir planilha:", e);
      setIsDeleting(null);
      alert('Não foi possível excluir a planilha: ' + (e.message || 'Erro desconhecido'));
    }
  };

  const handleSave = async (sheet: Spreadsheet) => {
    if (!canEdit || !user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'spreadsheets', sheet.id), {
        name: sheet.name,
        data: JSON.stringify(sheet.data),
        updatedBy: user.displayName || user.email,
        updatedAt: serverTimestamp()
      });
      setSaving(false);
    } catch (e: any) {
      console.error(e);
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!exportEnabled) {
      alert("Seu plano não permite exportação de planilhas. Faça um upgrade para habilitar.");
      return;
    }
    if (!currentSheet) return;
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + currentSheet.data.map(row => row.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${currentSheet.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    if (!currentSheet || !canEdit) return;
    const newData = [...currentSheet.data];
    newData[rowIndex] = [...newData[rowIndex]];
    newData[rowIndex][colIndex] = value;
    setCurrentSheet({ ...currentSheet, data: newData });
  };

  const getColLabel = (index: number) => {
    return `${String.fromCharCode(65 + index % 26)}${Math.floor(index / 26) > 0 ? Math.floor(index / 26) : ''}`;
  };

  const handleInsertColumn = (position: 'left' | 'right' | 'end') => {
    if (!currentSheet) return;
    if (!checkLimit(`adicionar mais colunas nesta planilha (limite de ${maxCols} colunas atingido no seu plano)`, currentSheet.data[0].length < maxCols)) {
      return;
    }
    
    let targetIndex = currentSheet.data[0].length;
    if (activeCell !== null && position !== 'end') {
      targetIndex = position === 'left' ? activeCell.colIndex : activeCell.colIndex + 1;
    }

    const newData = currentSheet.data.map(row => {
      const newRow = [...row];
      newRow.splice(targetIndex, 0, '');
      return newRow;
    });

    setCurrentSheet({ ...currentSheet, data: newData });
    setShowColPopup(false);
  };

  const handleInsertRow = (position: 'above' | 'below' | 'end') => {
    if (!currentSheet) return;
    if (!checkLimit(`adicionar mais linhas nesta planilha (limite de ${maxRows} linhas atingido no seu plano)`, currentSheet.data.length < maxRows)) {
      return;
    }
    
    let targetIndex = currentSheet.data.length;
    if (activeCell !== null && position !== 'end') {
      targetIndex = position === 'above' ? activeCell.rowIndex : activeCell.rowIndex + 1;
    }

    const numCols = currentSheet.data[0]?.length || 1;
    const newEmptyRow = Array(numCols).fill('');
    const newData = [...currentSheet.data];
    newData.splice(targetIndex, 0, newEmptyRow);

    setCurrentSheet({ ...currentSheet, data: newData });
    setShowRowPopup(false);
  };

  if (!spreadsheetEnabled) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-6 max-w-lg p-12 bg-white rounded-[2.5rem] shadow-2xl border">
          <div className="w-20 h-20 bg-neutral-100 rounded-3xl flex items-center justify-center mx-auto text-neutral-300">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight italic serif uppercase">Planilhas Bloqueadas</h2>
            <p className="text-neutral-500 font-medium">O Sistema de Planilhas Profissionais está disponível apenas nos planos Intermediário e Pro.</p>
          </div>
          <div className="flex justify-center gap-4">
             <Button variant="outline" className="rounded-2xl h-12 px-8 font-bold border-2" onClick={() => window.location.hash = '#subscription'}>
               Atualizar Plano
             </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      <AnimatePresence mode="wait">
        {!currentSheet ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <h1 className="text-3xl font-black tracking-tight italic serif uppercase">Planilhas</h1>
                </div>
                <p className="text-neutral-500 font-medium font-mono text-xs uppercase tracking-widest pl-1">
                  {spreadsheets.length} / {maxSpreadsheets} UTILIZADAS NO WORKSPACE
                </p>
              </div>
              <Button onClick={handleCreate} disabled={!canEdit || spreadsheets.length >= maxSpreadsheets} className="rounded-2xl h-14 px-8 font-bold shadow-xl shadow-green-500/10 bg-green-600 hover:bg-green-700">
                <Plus className="w-5 h-5 mr-2" />
                Criar Planilha
              </Button>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {spreadsheets.map((sheet) => (
                <Card 
                  key={sheet.id} 
                  className="group hover:scale-[1.02] hover:shadow-2xl transition-all cursor-pointer border-neutral-100 rounded-3xl overflow-hidden"
                  onClick={() => setCurrentSheet(sheet)}
                >
                  <CardContent className="p-0">
                    <div className="p-6 space-y-4">
                      <div className="aspect-[4/3] bg-neutral-50 rounded-2xl flex items-center justify-center group-hover:bg-green-50/50 transition-colors relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full p-4 grid grid-cols-4 grid-rows-3 gap-1 opacity-20 pointer-events-none">
                           {Array(12).fill(0).map((_, i) => <div key={i} className="bg-neutral-200 rounded-sm" />)}
                        </div>
                        <TableIcon className="w-12 h-12 text-neutral-200 group-hover:text-green-500 transition-all duration-500 group-hover:scale-110" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-lg text-neutral-900 group-hover:text-green-600 transition-colors truncate">
                          {sheet.name}
                        </h3>
                        <div className="flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] font-black">{sheet.updatedBy?.[0]?.toUpperCase()}</div>
                           <p className="text-[10px] text-neutral-400 uppercase font-black tracking-widest">
                             {sheet.updatedBy}
                           </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                         <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-tighter">
                           {sheet.updatedAt ? new Date((sheet.updatedAt as any).toDate()).toLocaleDateString() : 'Recente'}
                         </span>
                        {(canEdit || isAdmin || sheet.ownerId === user?.uid || sheet.userId === user?.uid || sheet.updatedBy === user?.email || sheet.updatedBy === user?.displayName) && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            disabled={isDeleting === sheet.id}
                            title="Excluir planilha"
                            className={cn(
                              "h-10 w-10 rounded-xl transition-all",
                              isDeleting === sheet.id ? "text-neutral-300" : "text-neutral-400 hover:text-red-500 hover:bg-red-50"
                            )}
                            onClick={(e) => handleDelete(sheet, e)}
                          >
                            {isDeleting === sheet.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {spreadsheets.length === 0 && !loading && (
                <div className="col-span-full py-24 flex flex-col items-center justify-center text-neutral-400 bg-neutral-50/50 rounded-[2.5rem] border-2 border-dashed border-neutral-200 space-y-4">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <FileSpreadsheet className="w-10 h-10 text-neutral-200" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-neutral-900">Nenhuma planilha encontrada</p>
                    <p className="text-sm">Comece criando sua primeira planilha de controle.</p>
                  </div>
                  <Button variant="outline" className="rounded-xl border-2" onClick={handleCreate} disabled={!canEdit}>
                    Criar Agora
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="editor"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex flex-col min-h-0 bg-white rounded-[2rem] border overflow-hidden shadow-2xl"
          >
            <div className="h-20 border-b flex items-center justify-between px-6 bg-white shrink-0">
              <div className="flex items-center gap-6">
                <Button variant="ghost" size="icon" onClick={() => setCurrentSheet(null)} className="rounded-2xl h-12 w-12 hover:bg-neutral-100">
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <div className="w-px h-10 bg-neutral-100" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                    <TableIcon className="w-6 h-6" />
                  </div>
                  <Input 
                    className="border-none bg-transparent font-black h-10 focus-visible:ring-0 text-xl w-64 uppercase tracking-tight italic"
                    value={currentSheet.name}
                    onChange={(e) => setCurrentSheet({ ...currentSheet, name: e.target.value })}
                    onBlur={() => handleSave(currentSheet)}
                    readOnly={!canEdit}
                  />
                  {realtimeCollaboration && (
                    <Badge className="bg-green-100 text-green-700 border-none px-2 h-6 text-[10px] whitespace-nowrap">
                      <Zap className="w-3 h-3 mr-1 fill-green-700" />
                      REALTIME
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {(advancedStyles || imageUploadEnabled) && (
                  <div className="hidden md:flex items-center gap-1 p-1 bg-neutral-50 rounded-xl border">
                    {advancedStyles && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Estilo de Texto" onClick={() => alert("Estilos avançados habilitados pelo seu plano PRO!")}>
                          <Type className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Cor de Fundo" onClick={() => alert("Paleta avançada habilitada pelo seu plano!")}>
                          <Palette className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Limpar Formatação">
                          <Eraser className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    {advancedStyles && imageUploadEnabled && <div className="w-px h-6 bg-neutral-200 mx-1" />}
                    {imageUploadEnabled && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-primary" title="Inserir Imagem" onClick={() => alert("Upload de imagens disponível no seu plano!")}>
                        <ImageIcon className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 relative">
                  {/* Popover Inserir Fila (Linha) */}
                  <div className="relative">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setShowRowPopup(!showRowPopup);
                        setShowColPopup(false);
                      }}
                      disabled={!canEdit}
                      className={cn(
                        "rounded-xl h-11 px-4 font-bold border-dashed border-neutral-300 hover:bg-neutral-50 transition-all",
                        showRowPopup && "bg-neutral-100 border-neutral-400 ring-2 ring-primary/20"
                      )}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Fila
                    </Button>

                    <AnimatePresence>
                      {showRowPopup && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          className="absolute left-0 top-13 z-50 w-64 bg-white rounded-2xl shadow-2xl border border-neutral-200 p-3 space-y-2 text-left"
                        >
                          <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                            <span className="text-xs font-bold text-neutral-800">Inserir Fila (Linha)</span>
                            <button onClick={() => setShowRowPopup(false)} className="text-neutral-400 hover:text-neutral-700">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-[11px] text-neutral-500 font-medium pb-1">
                            {activeCell ? (
                              <span>Linha selecionada: <strong className="text-neutral-900">#{activeCell.rowIndex + 1}</strong></span>
                            ) : (
                              <span>Nenhuma célula focada (será inserida no final)</span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {activeCell && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleInsertRow('above')}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left"
                                >
                                  <ArrowUp className="w-4 h-4 text-emerald-600" />
                                  <span>Acima da linha #{activeCell.rowIndex + 1}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleInsertRow('below')}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left"
                                >
                                  <ArrowDown className="w-4 h-4 text-emerald-600" />
                                  <span>Abaixo da linha #{activeCell.rowIndex + 1}</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleInsertRow('end')}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left border-t border-neutral-100 pt-2"
                            >
                              <CornerDownRight className="w-4 h-4 text-neutral-500" />
                              <span>No final da planilha</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Popover Inserir Coluna */}
                  <div className="relative">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setShowColPopup(!showColPopup);
                        setShowRowPopup(false);
                      }}
                      disabled={!canEdit}
                      className={cn(
                        "rounded-xl h-11 px-4 font-bold border-dashed border-neutral-300 hover:bg-neutral-50 transition-all",
                        showColPopup && "bg-neutral-100 border-neutral-400 ring-2 ring-primary/20"
                      )}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Coluna
                    </Button>

                    <AnimatePresence>
                      {showColPopup && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          className="absolute left-0 top-13 z-50 w-64 bg-white rounded-2xl shadow-2xl border border-neutral-200 p-3 space-y-2 text-left"
                        >
                          <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                            <span className="text-xs font-bold text-neutral-800">Inserir Nova Coluna</span>
                            <button onClick={() => setShowColPopup(false)} className="text-neutral-400 hover:text-neutral-700">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-[11px] text-neutral-500 font-medium pb-1">
                            {activeCell ? (
                              <span>Coluna selecionada: <strong className="text-neutral-900">{getColLabel(activeCell.colIndex)} (coluna {activeCell.colIndex + 1})</strong></span>
                            ) : (
                              <span>Nenhuma célula focada (será inserida no final)</span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {activeCell && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleInsertColumn('left')}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left"
                                >
                                  <ArrowLeft className="w-4 h-4 text-emerald-600" />
                                  <span>À esquerda da coluna {getColLabel(activeCell.colIndex)}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleInsertColumn('right')}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left"
                                >
                                  <ArrowRight className="w-4 h-4 text-emerald-600" />
                                  <span>À direita da coluna {getColLabel(activeCell.colIndex)}</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => handleInsertColumn('end')}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left border-t border-neutral-100 pt-2"
                            >
                              <CornerDownRight className="w-4 h-4 text-neutral-500" />
                              <span>No final da planilha</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {exportEnabled && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        if (!checkLimit('ao recurso de exportação de planilhas (disponível a partir do Plano Intermediário)', !!exportEnabled)) {
                          return;
                        }
                        handleExport();
                      }}
                      className="rounded-xl h-11 px-4 font-bold border-dashed border-neutral-300 hover:bg-neutral-50"
                    >
                      <Download className="w-4 h-4 mr-2" /> Exportar
                    </Button>
                  )}
                  {(canEdit || isAdmin || currentSheet.ownerId === user?.uid || currentSheet.userId === user?.uid || currentSheet.updatedBy === user?.email || currentSheet.updatedBy === user?.displayName) && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      title="Excluir esta planilha"
                      onClick={() => handleDelete(currentSheet)}
                      disabled={isDeleting === currentSheet.id}
                      className="rounded-xl h-11 px-3 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 font-bold"
                    >
                      {isDeleting === currentSheet.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                      Excluir
                    </Button>
                  )}
                  <div className="w-px h-10 bg-neutral-100 mx-2" />
                  {saving && <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />}
                  <Button 
                    size="sm" 
                    onClick={() => handleSave(currentSheet)} 
                    disabled={!canEdit || saving}
                    className="rounded-xl px-6 font-semibold h-11"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-neutral-50 relative custom-scrollbar p-6">
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="border-collapse table-fixed min-w-full">
                  <thead>
                    <tr className="sticky top-0 z-10">
                      <th className="w-12 bg-neutral-100 border-b border-r text-[10px] font-bold text-neutral-500 h-8">#</th>
                      {currentSheet.data[0].map((_, i) => (
                        <th 
                          key={i} 
                          onClick={() => {
                            setActiveCell({ rowIndex: 0, colIndex: i });
                          }}
                          className={cn(
                            "w-32 bg-neutral-100 border-b border-r text-[10px] font-bold text-neutral-500 h-8 px-2 text-center cursor-pointer hover:bg-neutral-200 transition-colors",
                            activeCell?.colIndex === i && "bg-emerald-100 text-emerald-800 font-black"
                          )}
                          title={`Clique para selecionar coluna ${getColLabel(i)}`}
                        >
                          {getColLabel(i)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSheet.data.map((row, rowIndex) => (
                      <tr key={rowIndex} className="group hover:bg-muted/50 transition-colors">
                        <td 
                          onClick={() => {
                            setActiveCell({ rowIndex, colIndex: activeCell?.colIndex || 0 });
                          }}
                          className={cn(
                            "bg-neutral-50/50 border-b border-r text-[11px] font-semibold text-neutral-400 text-center sticky left-0 z-10 w-12 h-10 cursor-pointer hover:bg-neutral-200 transition-colors",
                            activeCell?.rowIndex === rowIndex && "bg-emerald-100 text-emerald-800 font-black"
                          )}
                          title={`Clique para selecionar linha #${rowIndex + 1}`}
                        >
                          {rowIndex + 1}
                        </td>
                        {row.map((cell, colIndex) => (
                          <td 
                            key={colIndex} 
                            onClick={() => setActiveCell({ rowIndex, colIndex })}
                            className={cn(
                              "border-b border-r p-0 focus-within:ring-2 focus-within:ring-primary/30 z-0 bg-background",
                              activeCell?.rowIndex === rowIndex && activeCell?.colIndex === colIndex && "ring-2 ring-emerald-500/50 bg-emerald-50/30"
                            )}
                          >
                            <input 
                              className="w-full h-10 px-3 text-sm border-none bg-transparent outline-none focus:bg-primary/5 font-medium text-foreground transition-colors"
                              value={cell || ''}
                              onFocus={() => setActiveCell({ rowIndex, colIndex })}
                              onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                              readOnly={!canEdit}
                              onBlur={() => handleSave(currentSheet)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
