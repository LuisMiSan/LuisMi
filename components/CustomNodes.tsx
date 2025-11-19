
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { SystemIcon, ContextIcon, ConditionIcon, ToolIcon, ResponseIcon, GoogleSearchIcon } from './icons/Icons';

const commonNodeStyle = "p-3 rounded-lg border shadow-md w-60";
const commonHeaderStyle = "flex items-center mb-2 pb-2 border-b";
const commonIconStyle = "w-5 h-5 mr-2";
const commonLabelStyle = "font-bold text-sm";
const commonContentStyle = "text-xs text-gray-600 dark:text-gray-300 break-words";

const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query || !text) {
    return <>{text}</>;
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    return <>{text}</>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-400 text-black px-0.5 rounded">{match}</mark>
      {after}
    </>
  );
};


const NodeWrapper: React.FC<{children: React.ReactNode, className: string}> = ({ children, className }) => (
  <div className={`${commonNodeStyle} ${className}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-500" />
    {children}
    <Handle type="source" position={Position.Right} className="!bg-gray-500" />
  </div>
);

export const SystemNode: React.FC<NodeProps<NodeData>> = ({ data }) => {
    const isHighlighted = data.highlightField === 'text' && data.highlightQuery;
    const displayText = data.text || 'System instructions...';

    return (
        <NodeWrapper className="bg-indigo-900 border-indigo-700 text-indigo-100">
            <div className={`${commonHeaderStyle} border-indigo-600`}>
                <SystemIcon className={`${commonIconStyle} text-indigo-400`} />
                <div className={commonLabelStyle}>{data.highlightField === 'type' && data.highlightQuery ? <Highlight text="System" query={data.highlightQuery} /> : 'System'}</div>
            </div>
            <div className={commonContentStyle}>
                {isHighlighted ? 
                    <Highlight text={displayText} query={data.highlightQuery!} /> : 
                    (displayText.substring(0, 50) + (displayText.length > 50 ? '...' : ''))
                }
            </div>
        </NodeWrapper>
    );
};

export const ContextNode: React.FC<NodeProps<NodeData>> = ({ data }) => {
    const isHighlighted = data.highlightField === 'text' && data.highlightQuery;
    const displayText = data.text || 'Background info...';

    return (
        <NodeWrapper className="bg-green-900 border-green-700 text-green-100">
            <div className={`${commonHeaderStyle} border-green-600`}>
                <ContextIcon className={`${commonIconStyle} text-green-400`} />
                <div className={commonLabelStyle}>{data.highlightField === 'type' && data.highlightQuery ? <Highlight text="Context" query={data.highlightQuery} /> : 'Context'}</div>
            </div>
            <div className={commonContentStyle}>
                {isHighlighted ?
                    <Highlight text={displayText} query={data.highlightQuery!} /> :
                    (displayText.substring(0, 50) + (displayText.length > 50 ? '...' : ''))
                }
            </div>
        </NodeWrapper>
    );
};

export const ConditionNode: React.FC<NodeProps<NodeData>> = ({ data }) => {
    const condition = data.condition || '...';
    const text = data.text || '...';

    return (
        <NodeWrapper className="bg-pink-900 border-pink-700 text-pink-100">
            <div className={`${commonHeaderStyle} border-pink-600`}>
                <ConditionIcon className={`${commonIconStyle} text-pink-400`} />
                <div className={commonLabelStyle}>{data.highlightField === 'type' && data.highlightQuery ? <Highlight text="Condition" query={data.highlightQuery} /> : 'Condition'}</div>
            </div>
            <div className={commonContentStyle}>
                <p className="font-semibold">IF: {data.highlightField === 'condition' && data.highlightQuery ? <Highlight text={condition} query={data.highlightQuery} /> : condition}</p>
                <p>THEN: {data.highlightField === 'text' && data.highlightQuery ? <Highlight text={text} query={data.highlightQuery} /> : (text.substring(0, 30) + (text.length > 30 ? '...' : ''))}</p>
            </div>
        </NodeWrapper>
    );
};


export const ToolNode: React.FC<NodeProps<NodeData>> = ({ data }) => {
    const hasSchema = data.responseSchema && data.responseSchema.properties && Object.keys(data.responseSchema.properties).length > 0;
    const toolName = data.toolName || 'Unnamed Tool';
    const toolDesc = data.toolDescription || 'No description.';

    // Validation Logic
    const isNameValid = !!data.toolName?.trim();
    const isDescValid = !!data.toolDescription?.trim();
    const areParamsValid = !data.toolParameters || data.toolParameters.every(p => !!p.key?.trim());
    const hasError = !isNameValid || !isDescValid || !areParamsValid;

    const borderClass = hasError ? "border-red-500 ring-1 ring-red-500" : "border-orange-700";
    
    return (
        <NodeWrapper className={`bg-orange-900 ${borderClass} text-orange-100`}>
            <div className={`${commonHeaderStyle} border-orange-600`}>
            <ToolIcon className={`${commonIconStyle} text-orange-400`} />
            <div className={`${commonLabelStyle} flex items-center justify-between flex-1`}>
                <div className="flex items-center">
                   {data.highlightField === 'type' && data.highlightQuery ? <Highlight text="Tool" query={data.highlightQuery} /> : 'Tool'}
                </div>
                 {hasError && <span className="text-red-300 text-[10px] uppercase tracking-wide bg-red-900/50 px-1 rounded ml-2">Invalid</span>}
            </div>
            </div>
            <div className={commonContentStyle}>
                <p className="font-semibold">
                    {data.highlightField === 'toolName' && data.highlightQuery ? <Highlight text={toolName} query={data.highlightQuery} /> : toolName}
                </p>
                <p>
                    {data.highlightField === 'toolDescription' && data.highlightQuery ? 
                        <Highlight text={toolDesc} query={data.highlightQuery} /> : 
                        (toolDesc.substring(0, 40) + (toolDesc.length > 40 ? '...' : ''))
                    }
                </p>
                {hasSchema && (
                    <div className="mt-2 pt-1 border-t border-orange-800 text-orange-300 font-semibold">
                        Returns JSON Schema
                    </div>
                )}
            </div>
        </NodeWrapper>
    );
};

export const ResponseNode: React.FC<NodeProps<NodeData>> = ({ data }) => {
    const hasSchema = data.responseSchema && data.responseSchema.properties && Object.keys(data.responseSchema.properties).length > 0;
    return (
        <NodeWrapper className="bg-cyan-900 border-cyan-700 text-cyan-100">
            <div className={`${commonHeaderStyle} border-cyan-600`}>
                <ResponseIcon className={`${commonIconStyle} text-cyan-400`} />
                <div className={commonLabelStyle}>{data.highlightField === 'type' && data.highlightQuery ? <Highlight text="Response" query={data.highlightQuery} /> : 'Response'}</div>
            </div>
            <div className={commonContentStyle}>
                {hasSchema ? 'Returns structured JSON.' : 'Returns standard text.'}
            </div>
        </NodeWrapper>
    );
};

export const GoogleSearchNode: React.FC<NodeProps<NodeData>> = ({ data }) => (
  <NodeWrapper className="bg-yellow-900 border-yellow-700 text-yellow-100">
    <div className={`${commonHeaderStyle} border-yellow-600`}>
      <GoogleSearchIcon className={`${commonIconStyle} text-yellow-400`} />
      <div className={commonLabelStyle}>{data.highlightField === 'type' && data.highlightQuery ? <Highlight text="Google Search" query={data.highlightQuery} /> : 'Google Search'}</div>
    </div>
    <div className={commonContentStyle}>Grounds the model with Google Search results.</div>
  </NodeWrapper>
);
