import * as React from 'react';
import { cn } from '@/lib/utils';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { PostIt, WhiteboardLine, WhiteboardPoint } from '@/types';
import { executeDelete } from '@/lib/deleteHelper';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Pen,
  Move,
  ArrowUpRight,
  Minus,
  Eraser,
  Undo2,
  Trash2,
  Grid3X3,
  AlignJustify,
  Square,
  Palette,
  Plus,
  Edit2,
  Check,
  X,
  Loader2,
  StickyNote
} from 'lucide-react';
import { motion } from 'motion/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface WhiteboardProps {
  notes: PostIt[];
  onDeleteNote: (id: string, noteOwnerId?: string) => Promise<void>;
  onUpdateNote: (id: string, content: string) => Promise<void>;
  colorsToUse: string[];
}

type ToolMode = 'select' | 'freehand' | 'straight' | 'arrow' | 'eraser';
type GridType = 'dots' | 'grid' | 'ruled' | 'blank';

const LINE_COLORS = [
  { name: 'Grafite', hex: '#1e293b' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Vermelho', hex: '#dc2626' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Amarelo', hex: '#d97706' },
  { name: 'Roxo', hex: '#7c3aed' },
  { name: 'Rosa', hex: '#db2777' },
  { name: 'Laranja', hex: '#ea580c' },
];

const STROKE_WIDTHS = [
  { label: 'Fina', value: 2 },
  { label: 'Média', value: 4 },
  { label: 'Grossa', value: 7 },
];

export default function Whiteboard({ notes, onDeleteNote, onUpdateNote, colorsToUse }: WhiteboardProps) {
  const { currentWorkspace, canEdit, isAdmin } = useWorkspace();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Line drawing states
  const [lines, setLines] = React.useState<WhiteboardLine[]>([]);
  const [tool, setTool] = React.useState<ToolMode>('select');
  const [lineColor, setLineColor] = React.useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = React.useState(3);
  const [isDashed, setIsDashed] = React.useState(false);
  const [gridType, setGridType] = React.useState<GridType>('dots');

  // Active drawing state
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [currentPoints, setCurrentPoints] = React.useState<WhiteboardPoint[]>([]);

  // Note editing inside whiteboard
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');
  const [hoveredNoteId, setHoveredNoteId] = React.useState<string | null>(null);

  // Sync lines in real time from Firestore
  React.useEffect(() => {
    if (!currentWorkspace) return;

    const q = query(
      collection(db, 'whiteboard_lines'),
      where('workspaceId', '==', currentWorkspace.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const linesData = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          let parsedPoints: WhiteboardPoint[] = [];
          if (typeof data.points === 'string') {
            try {
              parsedPoints = JSON.parse(data.points);
            } catch {
              parsedPoints = [];
            }
          } else if (Array.isArray(data.points)) {
            parsedPoints = data.points;
          }
          return {
            id: docSnap.id,
            workspaceId: data.workspaceId,
            userId: data.userId || data.ownerId || '',
            ownerId: data.ownerId || data.userId || '',
            toolType: data.toolType || 'freehand',
            color: data.color || '#1e293b',
            strokeWidth: data.strokeWidth || 3,
            points: parsedPoints,
            createdAt: data.createdAt,
          } as WhiteboardLine;
        });
        setLines(linesData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'whiteboard_lines');
      }
    );

    return () => unsubscribe();
  }, [currentWorkspace]);

  // Coordinates helper
  const getCoordinates = (e: React.PointerEvent<SVGSVGElement>): WhiteboardPoint | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    };
  };

  // Drawing event handlers
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canEdit || tool === 'select' || tool === 'eraser') return;
    const pt = getCoordinates(e);
    if (!pt) return;

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDrawing(true);
    setCurrentPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || !canEdit || tool === 'select') return;
    const pt = getCoordinates(e);
    if (!pt) return;

    if (tool === 'freehand') {
      setCurrentPoints((prev) => [...prev, pt]);
    } else if (tool === 'straight' || tool === 'arrow') {
      setCurrentPoints((prev) => [prev[0] || pt, pt]);
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || !canEdit || !currentWorkspace || currentPoints.length === 0) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    setIsDrawing(false);
    const finalPoints = [...currentPoints];
    setCurrentPoints([]);

    if (finalPoints.length < 2 && tool === 'freehand') return;

    try {
      await addDoc(collection(db, 'whiteboard_lines'), {
        workspaceId: currentWorkspace.id,
        userId: auth.currentUser?.uid || '',
        ownerId: auth.currentUser?.uid || '',
        toolType: tool,
        color: lineColor,
        strokeWidth: isDashed ? Math.max(strokeWidth, 2) : strokeWidth,
        points: JSON.stringify(finalPoints),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error saving whiteboard line:', error);
      handleFirestoreError(error, OperationType.CREATE, 'whiteboard_lines');
    }
  };

  // Erase a line
  const handleDeleteLine = async (lineId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canEdit) return;
    try {
      await executeDelete('whiteboard_lines', lineId);
    } catch (error) {
      console.error('Error deleting line:', error);
    }
  };

  // Undo last line drawn by current user or last line in workspace
  const handleUndoLine = async () => {
    if (!canEdit || lines.length === 0) return;
    const userLines = lines.filter(
      (l) => l.ownerId === auth.currentUser?.uid || l.userId === auth.currentUser?.uid
    );
    const lineToDelete = userLines.length > 0 ? userLines[userLines.length - 1] : lines[lines.length - 1];
    if (lineToDelete) {
      await handleDeleteLine(lineToDelete.id);
    }
  };

  // Clear all lines
  const handleClearAllLines = async () => {
    if (!canEdit || lines.length === 0) return;

    try {
      const deletePromises = lines.map((line) => executeDelete('whiteboard_lines', line.id));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error clearing lines:', error);
    }
  };

  // Drag note handler
  const handleDragEnd = async (id: string, info: any) => {
    if (!canEdit || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = Math.max(10, Math.min(containerRect.width - 200, info.point.x - containerRect.left));
    const newY = Math.max(10, Math.min(containerRect.height - 180, info.point.y - containerRect.top));

    try {
      await updateDoc(doc(db, 'postits', id), {
        x: Math.round(newX),
        y: Math.round(newY),
      });
    } catch (err) {
      console.error('Failed to save post-it position:', err);
    }
  };

  // Change color of note
  const handleChangeNoteColor = async (id: string, color: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    try {
      await updateDoc(doc(db, 'postits', id), { color });
    } catch (err) {
      console.error('Failed to update note color:', err);
    }
  };

  // Path string builder
  const buildSvgPath = (points: WhiteboardPoint[], toolType: 'freehand' | 'straight' | 'arrow') => {
    if (!points || points.length === 0) return '';
    if (toolType === 'straight' || toolType === 'arrow') {
      const start = points[0];
      const end = points[points.length - 1];
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
    }
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const xc = (p1.x + p2.x) / 2;
      const yc = (p1.y + p2.y) / 2;
      d += ` Q ${p1.x} ${p1.y}, ${xc} ${yc}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  };

  return (
    <div className="space-y-3">
      {/* Top Whiteboard Control Bar */}
      <div className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Drawing & Selection Tools */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
          <Button
            size="sm"
            variant={tool === 'select' ? 'default' : 'ghost'}
            className={cn('h-8 px-3 rounded-lg text-xs font-bold gap-1.5', tool === 'select' && 'shadow-sm')}
            onClick={() => setTool('select')}
            title="Mover e organizar Post-its"
          >
            <Move className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mover</span>
          </Button>

          <Button
            size="sm"
            variant={tool === 'freehand' ? 'default' : 'ghost'}
            className={cn('h-8 px-3 rounded-lg text-xs font-bold gap-1.5', tool === 'freehand' && 'shadow-sm')}
            onClick={() => setTool('freehand')}
            title="Desenhar linhas livres"
          >
            <Pen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Caneta</span>
          </Button>

          <Button
            size="sm"
            variant={tool === 'straight' ? 'default' : 'ghost'}
            className={cn('h-8 px-3 rounded-lg text-xs font-bold gap-1.5', tool === 'straight' && 'shadow-sm')}
            onClick={() => setTool('straight')}
            title="Linha Reta"
          >
            <Minus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Linha Reta</span>
          </Button>

          <Button
            size="sm"
            variant={tool === 'arrow' ? 'default' : 'ghost'}
            className={cn('h-8 px-3 rounded-lg text-xs font-bold gap-1.5', tool === 'arrow' && 'shadow-sm')}
            onClick={() => setTool('arrow')}
            title="Seta Conectora"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Seta</span>
          </Button>

          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            className={cn('h-8 px-3 rounded-lg text-xs font-bold gap-1.5', tool === 'eraser' && 'shadow-sm text-red-600')}
            onClick={() => setTool('eraser')}
            title="Borracha de Linhas (clique numa linha para apagar)"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Borracha</span>
          </Button>
        </div>

        {/* Color Palette & Stroke Size */}
        {tool !== 'select' && tool !== 'eraser' && (
          <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1 rounded-xl border border-neutral-200">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider hidden md:inline">
              Cor:
            </span>
            <div className="flex items-center gap-1.5">
              {LINE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => setLineColor(c.hex)}
                  className={cn(
                    'w-5 h-5 rounded-full border transition-all',
                    lineColor === c.hex
                      ? 'scale-125 border-neutral-900 ring-2 ring-neutral-300'
                      : 'border-transparent hover:scale-110'
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="w-px h-5 bg-neutral-200 mx-1" />

            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider hidden md:inline">
              Espessura:
            </span>
            <div className="flex items-center gap-1">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  onClick={() => setStrokeWidth(sw.value)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-bold transition-all',
                    strokeWidth === sw.value
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                  )}
                >
                  {sw.label}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-neutral-200 mx-1" />

            <button
              type="button"
              onClick={() => setIsDashed(!isDashed)}
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-bold border transition-all',
                isDashed ? 'bg-primary text-white border-primary' : 'bg-white text-neutral-600 border-neutral-300'
              )}
            >
              Tracejada
            </button>
          </div>
        )}

        {/* Background Grid Style Selector & Undo */}
        <div className="flex items-center gap-2">
          {/* Grid selector */}
          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
            <Button
              size="icon"
              variant={gridType === 'dots' ? 'default' : 'ghost'}
              className="h-7 w-7 rounded-lg"
              title="Grade Pontilhada"
              onClick={() => setGridType('dots')}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant={gridType === 'grid' ? 'default' : 'ghost'}
              className="h-7 w-7 rounded-lg"
              title="Grade Quadriculada"
              onClick={() => setGridType('grid')}
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant={gridType === 'ruled' ? 'default' : 'ghost'}
              className="h-7 w-7 rounded-lg"
              title="Linhas Pautadas (Caderno)"
              onClick={() => setGridType('ruled')}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant={gridType === 'blank' ? 'default' : 'ghost'}
              className="h-7 w-7 rounded-lg"
              title="Fundo Liso"
              onClick={() => setGridType('blank')}
            >
              <Minus className="w-3.5 h-3.5 opacity-40" />
            </Button>
          </div>

          {/* Undo and clear buttons */}
          {lines.length > 0 && canEdit && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 rounded-xl text-xs font-bold border-neutral-200 hover:bg-neutral-100"
                onClick={handleUndoLine}
                title="Desfazer última linha"
              >
                <Undo2 className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Desfazer</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 rounded-xl text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                onClick={handleClearAllLines}
                title="Limpar todos os desenhos"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Whiteboard Canvas */}
      <div
        ref={containerRef}
        className={cn(
          'w-full h-[650px] rounded-3xl p-6 relative overflow-hidden select-none border border-neutral-300/80 shadow-inner transition-colors',
          gridType === 'dots' && 'bg-[#fcfdfd]',
          gridType === 'grid' && 'bg-[#f8fafc]',
          gridType === 'ruled' && 'bg-[#fffdfa]',
          gridType === 'blank' && 'bg-white'
        )}
      >
        {/* Background Grid Pattern */}
        {gridType === 'dots' && (
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(#64748b_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
        )}
        {gridType === 'grid' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage: 'linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        )}
        {gridType === 'ruled' && (
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              backgroundImage: 'linear-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '100% 32px',
            }}
          />
        )}

        {/* Whiteboard Title Badge */}
        <div className="absolute top-6 left-6 pointer-events-none z-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-black tracking-tight text-neutral-800 uppercase">
              Quadro Branco Interativo
            </h3>
          </div>
          <p className="text-[11px] text-neutral-400 font-medium">
            {tool === 'select' && 'Modo Mover: Arraste post-its para organizar.'}
            {tool === 'freehand' && 'Modo Caneta: Desenhe livremente sobre o quadro.'}
            {tool === 'straight' && 'Modo Linha Reta: Clique e arraste para traçar uma linha.'}
            {tool === 'arrow' && 'Modo Seta: Conecte ideias com setas direcionais.'}
            {tool === 'eraser' && 'Modo Borracha: Clique sobre qualquer traço para apagar.'}
          </p>
        </div>

        {/* SVG Drawing Layer */}
        <svg
          ref={svgRef}
          className={cn(
            'absolute inset-0 w-full h-full z-10',
            tool === 'select' ? 'pointer-events-none' : 'cursor-crosshair',
            tool === 'eraser' && 'cursor-pointer'
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <defs>
            {LINE_COLORS.map((c) => (
              <React.Fragment key={c.hex}>
                <marker
                  id={`arrowhead-${c.hex.replace('#', '')}`}
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill={c.hex} />
                </marker>
              </React.Fragment>
            ))}
          </defs>

          {/* Render Saved Lines */}
          {lines.map((line) => {
            const pathData = buildSvgPath(line.points, line.toolType);
            if (!pathData) return null;
            const markerId = `arrowhead-${line.color.replace('#', '')}`;

            return (
              <g key={line.id} className={cn(tool === 'eraser' ? 'pointer-events-auto cursor-pointer group' : 'pointer-events-none')}>
                {/* Wider invisible hit area for easy erasing */}
                {tool === 'eraser' && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(line.strokeWidth + 16, 20)}
                    onClick={(e) => handleDeleteLine(line.id, e)}
                    className="hover:stroke-red-400/40 transition-colors"
                  />
                )}
                <path
                  d={pathData}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={line.strokeWidth > 5 ? undefined : isDashed ? '8,6' : undefined}
                  markerEnd={line.toolType === 'arrow' ? `url(#${markerId})` : undefined}
                  className={cn(tool === 'eraser' && 'group-hover:stroke-red-500 transition-colors')}
                />
              </g>
            );
          })}

          {/* Render Active Drawing Line Preview */}
          {isDrawing && currentPoints.length > 0 && (
            <path
              d={buildSvgPath(currentPoints, tool === 'arrow' ? 'arrow' : tool === 'straight' ? 'straight' : 'freehand')}
              fill="none"
              stroke={lineColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={isDashed ? '8,6' : undefined}
              markerEnd={tool === 'arrow' ? `url(#arrowhead-${lineColor.replace('#', '')})` : undefined}
              className="opacity-90"
            />
          )}
        </svg>

        {/* Post-it Notes Layer on the Whiteboard */}
        <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
          {notes.map((note) => {
            const currentUid = auth.currentUser?.uid;
            const isOwner = Boolean(
              (note.ownerId && note.ownerId === currentUid) ||
              (note.userId && note.userId === currentUid)
            );
            const canDeleteThisNote = isAdmin || isOwner;

            return (
              <motion.div
                key={note.id}
                drag={canEdit && tool === 'select'}
                dragMomentum={false}
                onDragEnd={(_, info) => handleDragEnd(note.id, info)}
                onMouseEnter={() => setHoveredNoteId(note.id)}
                onMouseLeave={() => setHoveredNoteId(null)}
                className={cn(
                  'absolute w-52 p-3.5 rounded-2xl shadow-md border-t-4 transition-shadow pointer-events-auto',
                  note.color,
                  tool === 'select' ? 'cursor-grab active:cursor-grabbing hover:shadow-xl' : 'cursor-default',
                  hoveredNoteId === note.id && 'ring-2 ring-black/10'
                )}
                style={{
                  x: note.x ?? 120,
                  y: note.y ?? 120,
                  rotate: ((note.x ?? 0) + (note.y ?? 0)) % 6 - 3,
                }}
              >
                {/* Note Content / Editing */}
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="min-h-[80px] text-xs bg-white/80 rounded-xl resize-none p-2"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-700 hover:bg-emerald-100/50 rounded-lg"
                        onClick={async () => {
                          await onUpdateNote(note.id, editingText);
                          setEditingNoteId(null);
                        }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-neutral-600 rounded-lg"
                        onClick={() => setEditingNoteId(null)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-neutral-900 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>

                    {/* Note Action Bar on Hover or Tool Select */}
                    {canEdit && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/5">
                        {/* Quick Color Palette */}
                        <div className="flex gap-1">
                          {colorsToUse.slice(0, 4).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={(e) => handleChangeNoteColor(note.id, c, e)}
                              className={cn(
                                'w-3.5 h-3.5 rounded-full border border-black/10 transition-transform hover:scale-125',
                                c.split(' ')[0]
                              )}
                            />
                          ))}
                        </div>

                        {/* Action buttons: Edit & Delete */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-neutral-600 hover:text-neutral-900 rounded-md hover:bg-black/5"
                            title="Editar texto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNoteId(note.id);
                              setEditingText(note.content);
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>

                          {canDeleteThisNote && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-neutral-500 hover:text-red-600 rounded-md hover:bg-red-50"
                              title="Excluir nota"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteNote(note.id, note.ownerId || note.userId);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Empty state prompt if no notes */}
        {notes.length === 0 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-0">
            <StickyNote className="w-12 h-12 text-neutral-300 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold text-neutral-400">Nenhum Post-it no quadro ainda</p>
            <p className="text-xs text-neutral-400">Adicione uma nota acima ou desenhe esquemas livremente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
