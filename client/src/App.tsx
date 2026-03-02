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
  Link,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './styles.css';

interface Attribute {
  id: string;
  name: string;
  isPrimary?: boolean;
  isForeign?: boolean;
  isNew?: boolean;
}

interface ERNodeData extends Record<string, unknown> {
  label: string;
  attributes?: Attribute[];
  isNew?: boolean;
  onLabelChange: (id: string, label: string) => void;
  onAddAttribute?: (id: string) => void;
  onUpdateAttribute?: (nodeId: string, attrId: string, name: string) => void;
  onDeleteAttribute?: (nodeId: string, attrId: string) => void;
  onTogglePrimary?: (nodeId: string, attrId: string) => void;
  onToggleForeign?: (nodeId: string, attrId: string) => void;
  onCardinalityChange?: (nodeId: string, handleId: string, val: string) => void;
  cardinality?: Record<string, string>;
}

type ERNode = Node<ERNodeData>;

const InlineEdit = ({ value, onSave, className = "", startEditing = false }: { value: string; onSave: (v: string) => void; className?: string; startEditing?: boolean }) => {
  const [editing, setEditing] = useState(startEditing);
  const [val, setVal] = useState(value);
  const lastClickTime = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditing(false);
      onSave(val);
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
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, [editing]);

  if (editing) {
    return (
      <input 
        ref={inputRef}
        className="inline-edit"
        value={val} 
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onSave(val); }}
        onKeyDown={handleKeyDown}
      />
    );
  }
  return (
    <div 
      className={className} 
      onClick={handleClick}
      onDoubleClick={() => setEditing(true)}
      style={{ cursor: 'pointer', userSelect: 'none', touchAction: 'manipulation' }}
    >
      {value}
    </div>
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
      <NodeResizer minWidth={160} isVisible={selected} handleStyle={{ width: 8, height: 8 }} />
      <div className="entity-header">
        <InlineEdit value={data.label} onSave={(v) => data.onLabelChange(id, v)} startEditing={data.isNew} />
      </div>
      <div className="entity-attributes">
        {data.attributes?.map((attr) => (
          <div key={attr.id} className={`attribute-row ${attr.isPrimary ? 'primary-key' : ''} ${attr.isForeign ? 'foreign-key' : ''}`}>
            <div className="attr-label-container">
              <div style={{ display: 'flex', gap: '2px', width: '24px', flexShrink: 0 }}>
                {attr.isPrimary && <Key size={10} color="#2563eb" />}
                {attr.isForeign && <Link size={10} color="#10b981" />}
              </div>
              <InlineEdit 
                value={attr.name} 
                onSave={(v) => data.onUpdateAttribute?.(id, attr.id, v)} 
                startEditing={attr.isNew}
              />
            </div>
            <div className="attr-actions">
              <button className={`attr-action-btn ${attr.isPrimary ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); data.onTogglePrimary?.(id, attr.id); }} title="Toggle PK">
                <Key size={12} />
              </button>
              <button className={`attr-action-btn ${attr.isForeign ? 'active-fk' : ''}`} onClick={(e) => { e.stopPropagation(); data.onToggleForeign?.(id, attr.id); }} title="Toggle FK">
                <Link size={12} />
              </button>
              <button className="attr-action-btn delete" onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Delete this attribute?')) {
                  data.onDeleteAttribute?.(id, attr.id);
                }
              }} title="Delete Attribute">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className="add-attr-btn" onClick={(e) => { e.stopPropagation(); data.onAddAttribute?.(id); }}>
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

const nodeTypes = { entity: EntityNode, relationship: RelationshipNode };
const edgeTypes = { erEdge: EREdge };

function AppContent() {
  const { deleteElements } = useReactFlow();
  const [nodes, setNodes] = useNodesState<ERNode>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isDark, setIsDark] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

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
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const attributes = [...(n.data.attributes || []), { id: Date.now().toString(), name: 'new_attr', isPrimary: false, isForeign: false, isNew: true }];
        return { ...n, data: { ...n.data, attributes } };
      }
      return n;
    }));
  }, [setNodes, saveToHistory]);

  const onUpdateAttribute = useCallback((nodeId: string, attrId: string, name: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const attributes = n.data.attributes?.map(a => a.id === attrId ? { ...a, name, isNew: false } : a);
        return { ...n, data: { ...n.data, attributes } };
      }
      return n;
    }));
  }, [setNodes, saveToHistory]);

  const onDeleteAttribute = useCallback((nodeId: string, attrId: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const attributes = n.data.attributes?.filter(a => a.id !== attrId);
        return { ...n, data: { ...n.data, attributes } };
      }
      return n;
    }));
  }, [setNodes, saveToHistory]);

  const onTogglePrimary = useCallback((nodeId: string, attrId: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const attributes = n.data.attributes?.map(a => a.id === attrId ? { ...a, isPrimary: !a.isPrimary } : a);
        return { ...n, data: { ...n.data, attributes } };
      }
      return n;
    }));
  }, [setNodes, saveToHistory]);

  const onToggleForeign = useCallback((nodeId: string, attrId: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const attributes = n.data.attributes?.map(a => a.id === attrId ? { ...a, isForeign: !a.isForeign } : a);
        return { ...n, data: { ...n.data, attributes } };
      }
      return n;
    }));
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
      let sourceH, relTargetH, relSourceH, targetH;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) { sourceH = 'r'; relTargetH = 'l-t'; relSourceH = 'r'; targetH = 'l-t'; }
        else { sourceH = 'l'; relTargetH = 'r-t'; relSourceH = 'l'; targetH = 'r-t'; }
      } else {
        if (dy > 0) { sourceH = 'b'; relTargetH = 't-t'; relSourceH = 'b'; targetH = 't-t'; }
        else { sourceH = 't'; relTargetH = 'b-t'; relSourceH = 't'; targetH = 'b-t'; }
      }
      const newRelNode: ERNode = {
        id: relId,
        type: 'relationship',
        position: midpoint,
        data: { 
          label: 'Relationship',
          cardinality: {},
          isNew: true,
          onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onToggleForeign, onCardinalityChange
        },
      };
      setNodes(nds => nds.concat(newRelNode));
      setEdges(eds => [
        ...eds,
        { id: `e_${Date.now()}_1`, source: params.source!, target: relId, sourceHandle: sourceH, targetHandle: relTargetH, type: 'erEdge' },
        { id: `e_${Date.now()}_2`, source: relId, target: params.target!, sourceHandle: relSourceH, targetHandle: targetH, type: 'erEdge' }
      ]);
      return;
    }
    if (sourceNode?.type === targetNode?.type) {
      alert(`${sourceNode?.type === 'entity' ? 'Entities' : 'Relationships'} cannot be connected directly.`);
      return;
    }
    saveToHistory();
    setEdges((eds) => addEdge({ ...params, type: 'erEdge' }, eds));
  }, [setEdges, setNodes, saveToHistory, onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onToggleForeign, onCardinalityChange]);

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
    const newNode: ERNode = {
      id: `node_${Date.now()}`,
      type,
      position,
      data: { 
        label: type.charAt(0).toUpperCase() + type.slice(1),
        attributes: type === 'entity' ? [{ id: '1', name: 'id', isPrimary: true, isForeign: false }] : [],
        cardinality: {},
        isNew: true,
        onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onToggleForeign, onCardinalityChange
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onToggleForeign, onCardinalityChange, setNodes, saveToHistory]);

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
      data: { ...n.data, onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onToggleForeign, onCardinalityChange }
    })));
  }, [onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onToggleForeign, onCardinalityChange, setNodes]);

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
          <div className="dndnode relationship" onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'relationship'); }} onClick={() => handleSidebarItemClick('relationship')} draggable><Diamond size={18} /> Relationship</div>
        </div>
        <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>{isDark ? <Sun size={18} /> : <Moon size={18} />}{isDark ? 'Light Mode' : 'Dark Mode'}</button>
      </aside>
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
