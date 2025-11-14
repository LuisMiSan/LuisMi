
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { SystemIcon, ContextIcon, ConditionIcon, ToolIcon, ResponseIcon, GoogleSearchIcon } from './icons/Icons';

const commonNodeStyle = "p-3 rounded-lg border shadow-md w-60";
const commonHeaderStyle = "flex items-center mb-2 pb-2 border-b";
const commonIconStyle = "w-5 h-5 mr-2";
const commonLabelStyle = "font-bold text-sm";
const commonContentStyle = "text-xs text-gray-600 dark:text-gray-300";

const NodeWrapper: React.FC<{children: React.ReactNode, className: string}> = ({ children, className }) => (
  <div className={`${commonNodeStyle} ${className}`}>
    <Handle type="target" position={Position.Left} className="!bg-gray-500" />
    {children}
    <Handle type="source" position={Position.Right} className="!bg-gray-500" />
  </div>
);

export const SystemNode: React.FC<NodeProps<NodeData>> = ({ data }) => (
  <NodeWrapper className="bg-indigo-900 border-indigo-700 text-indigo-100">
    <div className={`${commonHeaderStyle} border-indigo-600`}>
      <SystemIcon className={`${commonIconStyle} text-indigo-400`} />
      <div className={commonLabelStyle}>System</div>
    </div>
    <div className={commonContentStyle}>{data.text ? data.text.substring(0, 50) + '...' : 'System instructions...'}</div>
  </NodeWrapper>
);

export const ContextNode: React.FC<NodeProps<NodeData>> = ({ data }) => (
  <NodeWrapper className="bg-green-900 border-green-700 text-green-100">
    <div className={`${commonHeaderStyle} border-green-600`}>
      <ContextIcon className={`${commonIconStyle} text-green-400`} />
      <div className={commonLabelStyle}>Context</div>
    </div>
    <div className={commonContentStyle}>{data.text ? data.text.substring(0, 50) + '...' : 'Background info...'}</div>
  </NodeWrapper>
);

export const ConditionNode: React.FC<NodeProps<NodeData>> = ({ data }) => (
  <NodeWrapper className="bg-pink-900 border-pink-700 text-pink-100">
    <div className={`${commonHeaderStyle} border-pink-600`}>
      <ConditionIcon className={`${commonIconStyle} text-pink-400`} />
      <div className={commonLabelStyle}>Condition</div>
    </div>
    <div className={commonContentStyle}>
        <p className="font-semibold">IF: {data.condition || '...'}</p>
        <p>THEN: {data.text ? data.text.substring(0, 30) + '...' : '...'}</p>
    </div>
  </NodeWrapper>
);


export const ToolNode: React.FC<NodeProps<NodeData>> = ({ data }) => (
  <NodeWrapper className="bg-orange-900 border-orange-700 text-orange-100">
    <div className={`${commonHeaderStyle} border-orange-600`}>
      <ToolIcon className={`${commonIconStyle} text-orange-400`} />
      <div className={commonLabelStyle}>Tool</div>
    </div>
    <div className={commonContentStyle}>
        <p className="font-semibold">{data.toolName || 'Unnamed Tool'}</p>
        <p>{data.toolDescription ? data.toolDescription.substring(0, 40) + '...' : 'No description.'}</p>
    </div>
  </NodeWrapper>
);

export const ResponseNode: React.FC<NodeProps<NodeData>> = ({ data }) => (
  <NodeWrapper className="bg-cyan-900 border-cyan-700 text-cyan-100">
    <div className={`${commonHeaderStyle} border-cyan-600`}>
      <ResponseIcon className={`${commonIconStyle} text-cyan-400`} />
      <div className={commonLabelStyle}>Response</div>
    </div>
    <div className={commonContentStyle}>Defines JSON output schema.</div>
  </NodeWrapper>
);

export const GoogleSearchNode: React.FC<NodeProps<NodeData>> = () => (
    <NodeWrapper className="bg-yellow-900 border-yellow-700 text-yellow-100">
      <div className={`${commonHeaderStyle} border-yellow-600`}>
        <GoogleSearchIcon className={`${commonIconStyle} text-yellow-400`} />
        <div className={commonLabelStyle}>Google Search</div>
      </div>
      <div className={commonContentStyle}>Grounds responses with search results.</div>
    </NodeWrapper>
  );
