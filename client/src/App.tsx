import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Panel,
  Handle,
  Position,
  NodeResizer,
  getSmoothStepPath,
  BaseEdge,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  useHandleConnections,
} from '@xyflow/react';
import type {
  Edge,
  Node,
  NodeProps,
  EdgeProps,
  OnConnect,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import { 
  Square, 
  Diamond, 
  Database, 
  Trash2,
  Sun,
  Moon,
  Plus,
  Key,
  X,
  Menu,
  ChevronLeft,
  Undo2,
  Redo2,
  FileUp,
  Info,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './styles.css';

interface ERNodeData extends Record<string, unknown> {
  label: string;
  isNew?: boolean;
  isCollapsed?: boolean;
  isPrimary?: boolean;
  onLabelChange: (id: string, label: string) => void;
  onAddAttribute?: (id: string) => void;
  onTogglePrimary?: (id: string) => void;
  onCardinalityChange?: (nodeId: string, handleId: string, val: string) => void;
  cardinality?: Record<string, string>;
}

type ERNode = Node<ERNodeData>;

const InlineEdit = ({ value, onSave, className = "", startEditing = false }: { value: string; onSave: (v: string) => void; className?: string; startEditing?: boolean }) => {
  const [editing, setEditing] = useState(startEditing);
  const lastClickTime = useRef(0);
  const spanRef = useRef<HTMLSpanElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditing(false);
      onSave(spanRef.current?.innerText || value);
    }
  };

  const handleClick = () => {
    const now = Date.now();
    if (now - lastClickTime.current < 300) {
      setEditing(true);
    }
    lastClickTime.current = now;
  };

  useEffect(() => {
    if (editing && spanRef.current) {
      const span = spanRef.current;
      // Use a small timeout to ensure the element is ready and visible
      const timer = setTimeout(() => {
        span.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(span);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editing]);

  return (
    <span
      ref={spanRef}
      className={`${className} ${editing ? 'inline-edit-active' : ''}`}
      contentEditable={editing}
      suppressContentEditableWarning={true}
      onClick={handleClick}
      onDoubleClick={() => setEditing(true)}
      onBlur={() => { setEditing(false); onSave(spanRef.current?.innerText || value); }}
      onKeyDown={handleKeyDown}
      style={{ 
        cursor: 'pointer', 
        userSelect: 'none', 
        touchAction: 'manipulation',
        display: 'inline-block',
        minWidth: '20px',
        outline: 'none',
        wordBreak: 'break-word',
        textAlign: 'center'
      }}
    >
      {value}
    </span>
  );
};

const CardinalityPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div 
      className="cardinality-picker attached" 
      onMouseEnter={() => setHovered(true)} 
      onMouseLeave={() => setHovered(false)} 
      onClick={(e) => e.stopPropagation()}
    >
      {['1', 'N', 'M'].map(v => {
        if (!hovered && value !== v) return null;
        return (
          <button key={v} className={value === v ? 'active' : ''} onClick={(e) => { e.stopPropagation(); onChange(v); }}>
            {v}
          </button>
        );
      })}
    </div>
  );
};

const CornerPicker = ({ nodeId, handleIds, pos, data }: { nodeId: string; handleIds: string[]; pos: Position; data: ERNodeData }) => {
  const connections1 = useHandleConnections({ type: 'source', id: handleIds[0] });
  const connections2 = useHandleConnections({ type: 'target', id: handleIds[1] });
  const isConnected = connections1.length > 0 || connections2.length > 0;

  if (!isConnected) return null;

  const styles: Record<string, React.CSSProperties> = {
    [Position.Top]:    { position: 'absolute', top: -35, left: '50%', transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center', zIndex: 100 },
    [Position.Bottom]: { position: 'absolute', bottom: -35, left: '50%', transform: 'translateX(-50%)', display: 'flex', justifyContent: 'center', zIndex: 100 },
    [Position.Left]:   { position: 'absolute', left: -35, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 100 },
    [Position.Right]:  { position: 'absolute', right: -35, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 100 },
  };

  const activeHandle = connections1.length > 0 ? handleIds[0] : handleIds[1];

  return (
    <div style={styles[pos]}>
      <CardinalityPicker 
        value={data.cardinality?.[activeHandle] || '1'} 
        onChange={(v) => data.onCardinalityChange?.(nodeId, activeHandle, v)} 
      />
    </div>
  );
};

const EntityNode = ({ data, selected, id }: NodeProps<ERNode>) => {
  return (
    <div className={`entity-table ${selected ? 'selected' : ''}`}>
      <NodeResizer minWidth={140} minHeight={50} isVisible={selected} handleStyle={{ width: 8, height: 8 }} />
      <div className="entity-header">
        <InlineEdit value={data.label} onSave={(v) => data.onLabelChange(id, v)} startEditing={data.isNew} />
      </div>
      
      <button className="add-attr-btn-floating" onClick={(e) => { e.stopPropagation(); data.onAddAttribute?.(id); }} title="Add Attribute">
        <Plus size={14} />
      </button>

      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="target" position={Position.Top} id="t-t" />
      <Handle type="target" position={Position.Bottom} id="b-t" />
      <Handle type="target" position={Position.Left} id="l-t" />
      <Handle type="target" position={Position.Right} id="r-t" />
    </div>
  );
};

const AttributeNode = ({ data, selected, id }: NodeProps<ERNode>) => {
  return (
    <div className={`attribute-oval ${selected ? 'selected' : ''} ${data.isPrimary ? 'primary-key' : ''}`}>
      <NodeResizer minWidth={100} minHeight={45} isVisible={selected} handleStyle={{ width: 8, height: 8 }} />
      <div className="attribute-label-container">
        {data.isPrimary && <Key size={12} color="#2563eb" style={{ marginRight: 4 }} />}
        <InlineEdit value={data.label} onSave={(v) => data.onLabelChange(id, v)} startEditing={data.isNew} />
      </div>
      
      <div className="attr-node-actions">
        <button className={`attr-node-btn ${data.isPrimary ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); data.onTogglePrimary?.(id); }} title="Toggle PK">
          <Key size={14} />
        </button>
      </div>

      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="target" position={Position.Top} id="t-t" />
      <Handle type="target" position={Position.Bottom} id="b-t" />
      <Handle type="target" position={Position.Left} id="l-t" />
      <Handle type="target" position={Position.Right} id="r-t" />
    </div>
  );
};

const RelationshipNode = ({ data, id }: NodeProps<ERNode>) => {
  return (
    <div className="relationship-container">
      <div className="diamond"></div>
      <div className="relationship-label">
        <InlineEdit value={data.label} onSave={(v) => data.onLabelChange(id, v)} startEditing={data.isNew} />
      </div>

      <Handle type="source" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="source" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="target" position={Position.Top} id="t-t" />
      <Handle type="target" position={Position.Bottom} id="b-t" />
      <Handle type="target" position={Position.Left} id="l-t" />
      <Handle type="target" position={Position.Right} id="r-t" />

      <CornerPicker nodeId={id} handleIds={['t', 't-t']} pos={Position.Top} data={data} />
      <CornerPicker nodeId={id} handleIds={['b', 'b-t']} pos={Position.Bottom} data={data} />
      <CornerPicker nodeId={id} handleIds={['l', 'l-t']} pos={Position.Left} data={data} />
      <CornerPicker nodeId={id} handleIds={['r', 'r-t']} pos={Position.Right} data={data} />
    </div>
  );
};

const EREdge = ({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd }: EdgeProps) => {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 16 });
  return <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2 }} />;
};

const nodeTypes = { entity: EntityNode, relationship: RelationshipNode, attribute: AttributeNode };
const edgeTypes = { erEdge: EREdge };

function AppContent() {
  const { deleteElements } = useReactFlow();
  const [nodes, setNodes] = useNodesState<ERNode>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isDark, setIsDark] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sqlText, setSqlText] = useState('');

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyRef = useRef<{ nodes: ERNode[], edges: Edge[] }[]>([]);
  const redoRef = useRef<{ nodes: ERNode[], edges: Edge[] }[]>([]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const saveToHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-49), { nodes: nodesRef.current, edges: edgesRef.current }];
    redoRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const previous = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, { nodes: nodesRef.current, edges: edgesRef.current }];
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, { nodes: nodesRef.current, edges: edgesRef.current }];
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setNodes, setEdges]);

  const deleteSelected = useCallback(() => {
    const selectedNodes = nodesRef.current.filter(n => n.selected);
    const selectedEdges = edgesRef.current.filter(e => e.selected);
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      if (window.confirm(`Delete ${selectedNodes.length + selectedEdges.length} selected item(s)?`)) {
        saveToHistory();
        deleteElements({ nodes: selectedNodes, edges: selectedEdges });
      }
    }
  }, [deleteElements, saveToHistory]);

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    document.title = "ERD Designer";
  }, []);

  const onLabelChange = useCallback((id: string, label: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label, isNew: false } } : n));
  }, [setNodes, saveToHistory]);

  const onAddAttribute = useCallback((nodeId: string) => {
    saveToHistory();
    const entityNode = nodesRef.current.find(n => n.id === nodeId);
    if (!entityNode) return;

    const attrId = `node_${Date.now()}`;
    const newAttrNode: ERNode = {
      id: attrId,
      type: 'attribute',
      position: { x: entityNode.position.x + 200, y: entityNode.position.y },
      data: { 
        label: 'Attr',
        isNew: true,
        isPrimary: false,
        onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange
      },
    };

    setNodes(nds => nds.concat(newAttrNode));
    setEdges(eds => [
      ...eds,
      { id: `e_${Date.now()}`, source: nodeId, target: attrId, sourceHandle: 'r', targetHandle: 'l-t', type: 'erEdge' }
    ]);
  }, [setNodes, setEdges, onLabelChange]);

  const onTogglePrimary = useCallback((id: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, isPrimary: !n.data.isPrimary } } : n));
  }, [setNodes, saveToHistory]);

  const onCardinalityChange = useCallback((nodeId: string, handleId: string, val: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, cardinality: { ...(n.data.cardinality || {}), [handleId]: val } } };
      }
      return n;
    }));
  }, [setNodes, saveToHistory]);

  const onConnect: OnConnect = useCallback((params) => {
    const sourceNode = nodesRef.current.find(n => n.id === params.source);
    const targetNode = nodesRef.current.find(n => n.id === params.target);
    
    if (sourceNode?.type === 'entity' && targetNode?.type === 'entity') {
      saveToHistory();
      const relId = `node_${Date.now()}`;
      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;
      const midpoint = { x: sourceNode.position.x + dx / 2, y: sourceNode.position.y + dy / 2 };
      
      let sH, rtH, rsH, tH;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) { sH = 'r'; rtH = 'l-t'; rsH = 'r'; tH = 'l-t'; }
        else { sH = 'l'; rtH = 'r-t'; rsH = 'l'; tH = 'r-t'; }
      } else {
        if (dy > 0) { sH = 'b'; rtH = 't-t'; rsH = 'b'; tH = 't-t'; }
        else { sH = 't'; rtH = 'b-t'; rsH = 't'; tH = 'b-t'; }
      }

      const newRelNode: ERNode = {
        id: relId,
        type: 'relationship',
        position: midpoint,
        data: { 
          label: 'Relationship',
          cardinality: {},
          isNew: true,
          onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange
        },
      };
      setNodes(nds => nds.concat(newRelNode));
      setEdges(eds => [
        ...eds,
        { id: `e_${Date.now()}_1`, source: params.source!, target: relId, sourceHandle: sH, targetHandle: rtH, type: 'erEdge' },
        { id: `e_${Date.now()}_2`, source: relId, target: params.target!, sourceHandle: rsH, targetHandle: tH, type: 'erEdge' }
      ]);
      return;
    }

    if (sourceNode?.type === 'attribute' && targetNode?.type === 'attribute') {
      alert('Attributes cannot be connected directly.');
      return;
    }

    if (sourceNode?.type === 'relationship' && targetNode?.type === 'relationship') {
      alert('Relationships cannot be connected directly.');
      return;
    }

    saveToHistory();
    setEdges((eds) => addEdge({ ...params, type: 'erEdge' }, eds));
  }, [setEdges, setNodes, saveToHistory, onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'position' || c.type === 'remove')) { saveToHistory(); }
    setNodes((nds) => applyNodeChanges(changes, nds) as ERNode[]);
  }, [setNodes, saveToHistory]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some(c => c.type === 'remove')) { saveToHistory(); }
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges, saveToHistory]);

  const createNewNode = useCallback((type: string, position: { x: number, y: number }) => {
    saveToHistory();
    const labels: Record<string, string> = {
      entity: 'Entity',
      attribute: 'Attr',
      relationship: 'Rel'
    };
    const newNode: ERNode = {
      id: `node_${Date.now()}`,
      type,
      position,
      data: { 
        label: labels[type] || 'Node',
        cardinality: {},
        isNew: true,
        isPrimary: false,
        onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange, setNodes, saveToHistory]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!reactFlowInstance) return;
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    createNewNode(type, position);
  }, [reactFlowInstance, createNewNode]);

  const handleSidebarItemClick = (type: string) => {
    if (!reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    createNewNode(type, position);
    if (window.innerWidth <= 768) setIsSidebarOpen(false);
  };

  const handleImportSQL = () => {
    if (!sqlText.trim()) return;
    saveToHistory();

    const cleanSql = sqlText
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^INSERT\s+INTO[\s\S]*?;/gmi, '')
      .replace(/^LOCK\s+TABLES[\s\S]*?UNLOCK\s+TABLES;/gmi, '')
      .replace(/^DROP\s+TABLE[\s\S]*?;/gmi, '')
      .replace(/^SET\s+[\s\S]*?;/gmi, '')
      .replace(/\n\s*\n/g, '\n');

    const tables: ERNode[] = [];
    const attributes: ERNode[] = [];
    const relEdges: Edge[] = [];
    const attrEdges: Edge[] = [];
    const startRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"[])?([^`"\]\s\(\)]+)(?:[`"\]])?\s*\(/gi;
    let match;
    
    while ((match = startRegex.exec(cleanSql)) !== null) {
      const tableName = match[1];
      const startPos = startRegex.lastIndex;
      let depth = 1, endPos = startPos;
      while (depth > 0 && endPos < cleanSql.length) {
        if (cleanSql[endPos] === '(') depth++;
        else if (cleanSql[endPos] === ')') depth--;
        endPos++;
      }
      const tableContent = cleanSql.substring(startPos, endPos - 1);
      const lines = tableContent.split('\n').map(l => l.trim()).filter(l => l);
      
      const tableLevelPKs = new Set<string>();
      const pkMatch = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(tableContent);
      if (pkMatch) pkMatch[1].split(',').forEach(k => tableLevelPKs.add(k.replace(/[`"[]/g, '').trim()));

      const tableId = `node_${tableName}`;
      tables.push({
        id: tableId,
        type: 'entity',
        position: { x: 0, y: 0 },
        data: {
          label: tableName, isNew: false,
          onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange
        }
      });

      let attrCount = 0;
      lines.forEach((line) => {
        const fkMatch = /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:[`"[])?([^`"\]\s]+)(?:[`"\]])?\s*\(([^)]+)\)/i.exec(line);
        if (fkMatch) {
          const targetTable = fkMatch[2].replace(/[`"[]/g, '');
          (relEdges as any).push({ from: tableName, to: targetTable });
          return;
        }
        if (/^\s*(PRIMARY|FOREIGN|CONSTRAINT|KEY|UNIQUE|INDEX|CHECK)/i.test(line)) return;
        const colMatch = /^(?:[`"[])?([^`"\]\s]+)(?:[`"\]])?/.exec(line);
        if (!colMatch) return;
        const colName = colMatch[1];
        if (colName.toUpperCase() === 'CREATE' || colName.toUpperCase() === 'TABLE') return;
        
        const attrNodeId = `attr_${tableName}_${colName}`;
        attributes.push({
          id: attrNodeId,
          type: 'attribute',
          position: { x: 0, y: 0 },
          data: {
            label: colName,
            isPrimary: tableLevelPKs.has(colName) || /PRIMARY\s+KEY/i.test(line),
            isNew: false,
            onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange
          }
        });

        attrEdges.push({
          id: `e_${tableId}_${attrNodeId}`,
          source: tableId,
          target: attrNodeId,
          type: 'erEdge'
        });
        attrCount++;
      });
    }

    const columnsCount = Math.ceil(Math.sqrt(tables.length));
    const spacing = 600;
    
    const finalNodes: ERNode[] = [];
    tables.forEach((node, i) => {
      const tx = (i % columnsCount) * spacing;
      const ty = Math.floor(i / columnsCount) * spacing;
      node.position = { x: tx, y: ty };
      finalNodes.push(node);

      const tableAttrs = attributes.filter(a => a.id.startsWith(`attr_${node.data.label}_`));
      tableAttrs.forEach((attr, ai) => {
        const angle = (ai / tableAttrs.length) * 2 * Math.PI;
        attr.position = { x: tx + 180 * Math.cos(angle), y: ty + 120 * Math.sin(angle) };
        finalNodes.push(attr);
      });
    });

    // Create proper edges with smart handle selection for relationships
    const finalRelEdges: Edge[] = (relEdges as any).map((rel: any, idx: number) => {
      const source = finalNodes.find(n => n.data.label === rel.from && n.type === 'entity');
      const target = finalNodes.find(n => n.data.label === rel.to && n.type === 'entity');
      if (!source || !target) return null;

      const dx = target.position.x - source.position.x;
      const dy = target.position.y - source.position.y;
      let sH, tH;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) { sH = 'r'; tH = 'l-t'; } else { sH = 'l'; tH = 'r-t'; }
      } else {
        if (dy > 0) { sH = 'b'; tH = 't-t'; } else { sH = 't'; tH = 'b-t'; }
      }

      return {
        id: `e_import_rel_${idx}`,
        source: source.id,
        target: target.id,
        sourceHandle: sH,
        targetHandle: tH,
        type: 'erEdge'
      };
    }).filter(Boolean);

    setNodes(nds => {
      const filtered = nds.filter(n => !finalNodes.some(fn => fn.id === n.id));
      return [...filtered, ...finalNodes];
    });
    setEdges(eds => {
      const filtered = eds.filter(e => !finalRelEdges.some(fe => fe.id === e.id) && !attrEdges.some(ae => ae.id === e.id));
      return [...filtered, ...finalRelEdges, ...attrEdges];
    });
    setIsImportModalOpen(false);
    setSqlText('');
    setTimeout(() => { if (reactFlowInstance) reactFlowInstance.fitView({ padding: 0.2 }); }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setIsSidebarOpen(prev => !prev); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') { e.preventDefault(); handleSidebarItemClick('entity'); }
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteSelected, handleSidebarItemClick]);

  const onClear = () => {
    if (window.confirm('Are you sure you want to clear the entire diagram?')) {
      saveToHistory();
      setNodes([]);
      setEdges([]);
    }
  };

  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange }
    })));
  }, [onLabelChange, onAddAttribute, onTogglePrimary, onCardinalityChange, setNodes]);

  const hasSelected = nodes.some(n => n.selected) || edges.some(e => e.selected);

  return (
    <div className="dnd-container">
      <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
      </button>
      <aside className={!isSidebarOpen ? 'collapsed' : ''}>
        <div className="sidebar-header"><Database size={24} /><span>ERD Designer</span></div>
        <div className="sidebar-content">
          <div className="dndnode entity" onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'entity'); }} onClick={() => handleSidebarItemClick('entity')} draggable title="Add Entity (Ctrl+E)">
            <Square size={18} /> Entity
          </div>
          <div className="dndnode attribute" onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'attribute'); }} onClick={() => handleSidebarItemClick('attribute')} draggable>
            <div style={{ width: 18, height: 12, borderRadius: '50%', border: '2px solid currentColor' }} /> Attribute
          </div>
          <div className="dndnode relationship" onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'relationship'); }} onClick={() => handleSidebarItemClick('relationship')} draggable>
            <Diamond size={18} /> Relationship
          </div>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />
          <button className="import-btn" onClick={() => setIsImportModalOpen(true)}>
            <FileUp size={18} /> Import SQL Schema
          </button>
        </div>
        <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>{isDark ? <Sun size={18} /> : <Moon size={18} />}{isDark ? 'Light Mode' : 'Dark Mode'}</button>
      </aside>

      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => setIsImportModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import SQL Schema</h3>
              <button className="close-btn" onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="import-instructions">
              <div className="instruction-header"><Info size={16} /> How to export from MySQL Workbench:</div>
              <ol>
                <li>Open <strong>MySQL Workbench</strong> and connect to your instance.</li>
                <li>Click on <strong>Server</strong> &gt; <strong>Data Export</strong>.</li>
                <li>Select your <strong>Schema</strong> and choose <strong>Export to Self-Contained File</strong>.</li>
                <li>Click <strong>Start Export</strong>, then copy and paste the file content below.</li>
              </ol>
            </div>
            <textarea className="sql-textarea" placeholder="Paste your CREATE TABLE statements here..." value={sqlText} onChange={(e) => setSqlText(e.target.value)} />
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setIsImportModalOpen(false)}>Cancel</button>
              <button className="confirm-btn" onClick={handleImportSQL} disabled={!sqlText.trim()}>Import Schema</button>
            </div>
          </div>
        </div>
      )}

      <div className="reactflow-wrapper">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onInit={setReactFlowInstance} onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView panOnScroll={false} panOnDrag={true} selectionOnDrag={false} zoomOnPinch={true} zoomOnScroll={true} connectionRadius={50} attributionPosition="bottom-right">
          <Background color={isDark ? '#334155' : '#cbd5e1'} gap={20} />
          <Panel position="top-center">
            <div className="action-toolbar">
              <button className="toolbar-btn" onClick={undo} title="Undo (Ctrl+Z)"><Undo2 size={18} /></button>
              <button className="toolbar-btn" onClick={redo} title="Redo (Ctrl+Y)"><Redo2 size={18} /></button>
              <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />
              <button className="toolbar-btn delete" onClick={deleteSelected} disabled={!hasSelected} title="Delete Selected"><Trash2 size={18} /></button>
            </div>
          </Panel>
          <Controls showInteractive={true} />
          <Panel position="bottom-right" style={{ fontSize: '10px', opacity: 0.6, color: 'var(--text-color)', marginBottom: '10px', marginRight: '10px' }}>Himan Kalita - 2026</Panel>
          <Panel position="top-right" className="panel"><button onClick={onClear} title="Clear Canvas" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}><Trash2 size={20} /></button></Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function App() {
  return <ReactFlowProvider><AppContent /></ReactFlowProvider>;
}
