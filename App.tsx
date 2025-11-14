import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  Connection,
  XYPosition,
} from 'reactflow';
import { GoogleGenAI, Type } from '@google/genai';

import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { Header } from './components/Header';
import { LiveAgentModal } from './components/LiveAgentModal';
import { 
  SystemNode,
  ContextNode,
  ToolNode,
  ResponseNode,
  ConditionNode,
  GoogleSearchNode,
} from './components/CustomNodes';
import { BlockType, Model, NodeData } from './types';

const LOCAL_STORAGE_KEY = 'n8n-visual-prompt-builder-flow';

const App: React.FC = () => {
  const { initialNodes, initialEdges } = useMemo(() => {
    // Load saved state from localStorage on initial render
    try {
      const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // Basic validation of the stored data
        if (parsedState && Array.isArray(parsedState.nodes) && Array.isArray(parsedState.edges) && parsedState.nodes.length > 0) {
          return { initialNodes: parsedState.nodes, initialEdges: parsedState.edges };
        }
      }
    } catch (error) {
      console.error("Error loading workflow from localStorage:", error);
    }
    // Return a default tool node if nothing is saved or if there's an error
    const defaultNodes: Node<NodeData>[] = [{
        id: `tool-${+new Date()}`,
        type: BlockType.TOOL,
        position: { x: 250, y: 100 },
        data: {
          label: `Tool Block`,
          toolName: 'myExampleTool',
          toolDescription: 'Describe what this tool does.',
          toolParameters: [{ key: 'param1', description: 'description for param1' }],
          responseSchema: { type: Type.OBJECT, properties: {} }
        },
      }];
    return { initialNodes: defaultNodes, initialEdges: [] };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [generatedJson, setGeneratedJson] = useState<string>('');
  const [model, setModel] = useState<Model>(Model.FLASH);
  const [thinkingMode, setThinkingMode] = useState<boolean>(false);
  const [isLiveAgentOpen, setLiveAgentOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const nodeTypes = useMemo(() => ({
    [BlockType.SYSTEM]: SystemNode,
    [BlockType.CONTEXT]: ContextNode,
    [BlockType.TOOL]: ToolNode,
    [BlockType.RESPONSE]: ResponseNode,
    [BlockType.CONDITION]: ConditionNode,
    [BlockType.GOOGLE_SEARCH]: GoogleSearchNode,
  }), []);

  useEffect(() => {
    // Auto-save to localStorage whenever nodes or edges change
    const flowState = { nodes, edges };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(flowState));
  }, [nodes, edges]);
  
  useEffect(() => {
    if (thinkingMode) {
      setModel(Model.PRO);
    }
  }, [thinkingMode]);

  useEffect(() => {
    const generateJson = () => {
      const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

      const systemInstructions = sortedNodes
        .filter(node => node.type === BlockType.SYSTEM)
        .map(node => node.data.text)
        .join('\n');

      const tools: any[] = sortedNodes
        .filter(node => node.type === BlockType.TOOL && node.data.toolName)
        .map(node => ({
          functionDeclarations: [
            {
              name: node.data.toolName,
              description: node.data.toolDescription,
              parameters: {
                type: Type.OBJECT,
                properties: node.data.toolParameters?.reduce((acc, param) => {
                  if (param.key) { // Ensure key is not empty
                    acc[param.key] = { type: Type.STRING, description: param.description };
                  }
                  return acc;
                }, {} as Record<string, {type: Type, description: string}>) || {},
                required: node.data.toolParameters?.map(p => p.key).filter(Boolean) || [],
              },
            },
          ],
        }));

      if (sortedNodes.some(node => node.type === BlockType.GOOGLE_SEARCH)) {
        tools.push({ googleSearch: {} });
      }

      const responseNode = sortedNodes.find(node => node.type === BlockType.RESPONSE);
      const responseSchema = responseNode?.data.responseSchema;

      const promptParts = sortedNodes
        .filter(node => [BlockType.CONTEXT, BlockType.CONDITION].includes(node.type as BlockType))
        .map(node => {
            if (node.type === BlockType.CONDITION) {
                return `IF ${node.data.condition} THEN:\n${node.data.text}`;
            }
            return node.data.text;
        });
      
      const config: any = {};
      if (systemInstructions) {
        config.systemInstruction = systemInstructions;
      }
      if (tools.length > 0) {
        config.tools = tools;
      }
      if (responseSchema && responseSchema.properties && Object.keys(responseSchema.properties).length > 0) {
        config.responseMimeType = 'application/json';
        config.responseSchema = responseSchema;
      }
      if (thinkingMode) {
        config.thinkingConfig = { thinkingBudget: 32768 };
      }
      
      const prompt: any = {
        model: thinkingMode ? Model.PRO : model,
        contents: promptParts.filter(Boolean),
      };

      if (Object.keys(config).length > 0) {
        prompt.config = config;
      }

      setGeneratedJson(JSON.stringify(prompt, null, 2));
    };
    generateJson();
  }, [nodes, model, thinkingMode]);


  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!reactFlowBounds || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow') as BlockType;
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position: XYPosition = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNodeId = `${type}-${+new Date()}`;
      const newNode: Node<NodeData> = {
        id: newNodeId,
        type,
        position,
        data: {
          label: `${type} Block`,
          text: '',
          condition: '',
          toolName: '',
          toolDescription: '',
          toolParameters: [{ key: '', description: '' }],
          responseSchema: { type: Type.OBJECT, properties: {} }
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onNodeClick = (_: React.MouseEvent, node: Node<NodeData>) => {
    setSelectedNode(node);
  };
  
  const updateNodeData = (nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
            },
          };
        }
        return node;
      })
    );
     if (selectedNode?.id === nodeId) {
      setSelectedNode(prev => prev ? ({...prev, data: {...prev.data, ...newData}}) : null);
    }
  };

  const onExportWorkflow = useCallback(() => {
    const flowState = { nodes, edges };
    const jsonString = JSON.stringify(flowState, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'n8n-workflow.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) {
        return nodes.map(node => ({...node, className: ''}));
    }

    const lowerCaseQuery = searchQuery.toLowerCase();

    return nodes.map(node => {
        const { type, data } = node;
        let isMatch = false;

        if (type?.toLowerCase().replace('_', ' ').includes(lowerCaseQuery)) {
            isMatch = true;
        }

        if (!isMatch && data) {
            const searchableFields = [data.text, data.condition, data.toolName, data.toolDescription];
            if (searchableFields.some(field => field?.toLowerCase().includes(lowerCaseQuery))) {
                isMatch = true;
            }
        }
        
        return {
            ...node,
            className: isMatch ? 'node-highlighted' : 'node-dimmed'
        };
    });
  }, [nodes, searchQuery]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen bg-gray-900 text-white font-sans">
        <Header 
          model={model} 
          setModel={setModel} 
          thinkingMode={thinkingMode} 
          setThinkingMode={setThinkingMode} 
          onLiveAgentClick={() => setLiveAgentOpen(true)}
          onExport={onExportWorkflow}
          onSearchChange={setSearchQuery}
        />
        <div className="flex flex-grow" style={{ height: 'calc(100vh - 64px)' }}>
          <Sidebar />
          <div className="flex-grow h-full" ref={reactFlowWrapper}>
             <ReactFlow
              nodes={filteredNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNode(null)}
              nodeTypes={nodeTypes}
              fitView
              className="bg-gray-800"
            >
              <Background color="#4a5568" gap={16} />
              <Controls />
              <MiniMap nodeColor={n => {
                switch(n.type) {
                    case BlockType.SYSTEM: return '#6366f1';
                    case BlockType.CONTEXT: return '#22c55e';
                    case BlockType.TOOL: return '#f97316';
                    case BlockType.RESPONSE: return '#06b6d4';
                    case BlockType.CONDITION: return '#ec4899';
                    case BlockType.GOOGLE_SEARCH: return '#eab308';
                    default: return '#888';
                }
              }}/>
            </ReactFlow>
          </div>
          <div className="w-[600px] flex flex-col h-full bg-gray-900 border-l border-gray-700">
            {selectedNode ? (
              <PropertiesPanel key={selectedNode.id} node={selectedNode} updateNodeData={updateNodeData} />
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Select a node to edit its properties.</p>
                </div>
            )}
            <PreviewPanel json={generatedJson} />
          </div>
        </div>
      </div>
       {isLiveAgentOpen && <LiveAgentModal onClose={() => setLiveAgentOpen(false)} />}
    </ReactFlowProvider>
  );
};

export default App;