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
  ChevronLeft
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './styles.css';

interface Attribute {
  id: string;
  name: string;
  isPrimary?: boolean;
}

interface ERNodeData extends Record<string, unknown> {
  label: string;
  attributes?: Attribute[];
  onLabelChange: (id: string, label: string) => void;
  onAddAttribute?: (id: string) => void;
  onUpdateAttribute?: (nodeId: string, attrId: string, name: string) => void;
  onDeleteAttribute?: (nodeId: string, attrId: string) => void;
  onTogglePrimary?: (nodeId: string, attrId: string) => void;
  onCardinalityChange?: (nodeId: string, pos: 'left' | 'right', val: string) => void;
  cardinality?: {
    left?: string;
    right?: string;
  };
}

type ERNode = Node<ERNodeData>;

const InlineEdit = ({ value, onSave, className = "" }: { value: string; onSave: (v: string) => void; className?: string }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditing(false);
      onSave(val);
    }
  };

  if (editing) {
    return (
      <input 
        className="inline-edit"
        value={val} 
        onChange={e => setVal(e.target.value)}
        onBlur={() => { setEditing(false); onSave(val); }}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }
  return <div className={className} onDoubleClick={() => setEditing(true)}>{value}</div>;
};

const EntityNode = ({ data, selected, id }: NodeProps<ERNode>) => {
  return (
    <div className={`entity-table ${selected ? 'selected' : ''}`}>
      <NodeResizer minWidth={160} isVisible={selected} handleStyle={{ width: 8, height: 8 }} />
      <div className="entity-header">
        <InlineEdit value={data.label} onSave={(v) => data.onLabelChange(id, v)} />
      </div>
      <div className="entity-attributes">
        {data.attributes?.map((attr) => (
          <div key={attr.id} className={`attribute-row ${attr.isPrimary ? 'primary-key' : ''}`}>
            <div className="attr-label-container">
              {attr.isPrimary ? <Key size={10} color="#2563eb" /> : <div style={{width: 10}} />}
              <InlineEdit 
                value={attr.name} 
                onSave={(v) => data.onUpdateAttribute?.(id, attr.id, v)} 
              />
            </div>
            <div className="attr-actions">
               <button className={`attr-action-btn ${attr.isPrimary ? 'active' : ''}`} onClick={() => data.onTogglePrimary?.(id, attr.id)} title="Toggle PK">
                <Key size={12} />
              </button>
              <button className="attr-action-btn delete" onClick={() => {
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
      <button className="add-attr-btn" onClick={() => data.onAddAttribute?.(id)}>
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

const CardinalityPicker = ({ value, onChange, pos }: { value: string; onChange: (v: string) => void; pos: 'left' | 'right' }) => {
  const [hovered, setHovered] = useState(false);
  const styles: Record<string, any> = {
    left: { left: -85, top: '50%', transform: 'translateY(-50%)' },
    right: { right: -85, top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <div className="cardinality-picker" style={styles[pos]} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
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

const RelationshipNode = ({ data, id }: NodeProps<ERNode>) => {
  return (
    <div className="relationship-container">
      <div className="diamond"></div>
      <div className="relationship-label">
        <InlineEdit value={data.label} onSave={(v) => data.onLabelChange(id, v)} />
      </div>
      <CardinalityPicker pos="left" value={data.cardinality?.left || '1'} onChange={(v) => data.onCardinalityChange?.(id, 'left', v)} />
      <CardinalityPicker pos="right" value={data.cardinality?.right || '1'} onChange={(v) => data.onCardinalityChange?.(id, 'right', v)} />

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

const EREdge = ({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd }: EdgeProps) => {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 16 });
  return <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2 }} />;
};

const nodeTypes = { entity: EntityNode, relationship: RelationshipNode };
const edgeTypes = { erEdge: EREdge };

function AppContent() {
  const [nodes, setNodes] = useNodesState<ERNode>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [isDark, setIsDark] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    document.title = "ERD Designer";
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const onLabelChange = useCallback((id: string, label: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n));
  }, [setNodes, saveToHistory]);

  const onAddAttribute = useCallback((nodeId: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const attributes = [...(n.data.attributes || []), { id: Date.now().toString(), name: 'new_attr', isPrimary: false }];
        return { ...n, data: { ...n.data, attributes } };
      }
      return n;
    }));
  }, [setNodes, saveToHistory]);

  const onUpdateAttribute = useCallback((nodeId: string, attrId: string, name: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const attributes = n.data.attributes?.map(a => a.id === attrId ? { ...a, name } : a);
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

  const onCardinalityChange = useCallback((nodeId: string, pos: 'left' | 'right', val: string) => {
    saveToHistory();
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, cardinality: { ...n.data.cardinality, [pos]: val } } };
      }
      return n;
    }));
  }, [setNodes, saveToHistory]);

  const onConnect: OnConnect = useCallback((params) => {
    const sourceNode = nodesRef.current.find(n => n.id === params.source);
    const targetNode = nodesRef.current.find(n => n.id === params.target);
    if (sourceNode?.type === targetNode?.type) {
      const typeLabel = sourceNode?.type === 'entity' ? 'Entities' : 'Relationships';
      alert(`${typeLabel} cannot be connected directly.`);
      return;
    }
    saveToHistory();
    setEdges((eds) => addEdge({ ...params, type: 'erEdge' }, eds));
  }, [setEdges, saveToHistory]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'position' || c.type === 'remove')) {
      saveToHistory();
    }
    setNodes((nds) => applyNodeChanges(changes, nds) as ERNode[]);
  }, [setNodes, saveToHistory]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some(c => c.type === 'remove')) {
      saveToHistory();
    }
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges, saveToHistory]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!reactFlowInstance) return;
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    
    saveToHistory();
    const newNode: ERNode = {
      id: `node_${Date.now()}`,
      type,
      position,
      data: { 
        label: type.charAt(0).toUpperCase() + type.slice(1),
        attributes: type === 'entity' ? [{ id: '1', name: 'id', isPrimary: true }] : [],
        cardinality: type === 'relationship' ? { left: '1', right: '1' } : undefined,
        onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onCardinalityChange
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [reactFlowInstance, onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onCardinalityChange, setNodes, saveToHistory]);

  const onSave = useCallback(async () => {
    if (!reactFlowInstance) return;
    const flow = reactFlowInstance.toObject();
    const API_URL = import.meta.env.VITE_API_URL || 'https://erd-designer-api.onrender.com';
    try {
      await fetch(`${API_URL}/api/diagrams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flow),
      });
      alert('Diagram saved!');
    } catch (e) { alert('Save failed'); }
  }, [reactFlowInstance]);

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
      data: { 
        ...n.data, 
        onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onCardinalityChange 
      }
    })));
  }, [onLabelChange, onAddAttribute, onUpdateAttribute, onDeleteAttribute, onTogglePrimary, onCardinalityChange, setNodes]);

  return (
    <div className="dnd-container">
      <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
      </button>

      <aside className={!isSidebarOpen ? 'collapsed' : ''}>
        <div className="sidebar-header">
          <Database size={24} />
          <span>ERD Designer</span>
        </div>
        
        <div className="sidebar-content">
          <div className="dndnode entity" onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'entity'); }} draggable>
            <Square size={18} /> Entity
          </div>
          <div className="dndnode relationship" onDragStart={(e) => { e.dataTransfer.setData('application/reactflow', 'relationship'); }} draggable>
            <Diamond size={18} /> Relationship
          </div>
        </div>

        <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>
      </aside>

      <div className="reactflow-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          panOnScroll={false}
          panOnDrag={true}
          selectionOnDrag={false}
          zoomOnPinch={true}
          zoomOnScroll={true}
          connectionRadius={50}
          attributionPosition="bottom-right"
        >
          <Background color={isDark ? '#334155' : '#cbd5e1'} gap={20} />
          <Controls showInteractive={true} />
          <Panel position="bottom-right" style={{ fontSize: '10px', opacity: 0.5, color: isDark ? '#fff' : '#000' }}>
            Himan Kalita - 2026
          </Panel>
          <Panel position="top-right" className="panel">
            <button onClick={onClear} title="Clear Canvas" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>
              <Trash2 size={20} />
            </button>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}
