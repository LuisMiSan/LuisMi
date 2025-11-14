
import React from 'react';
import { BlockType } from '../types';
import { SystemIcon, ContextIcon, ConditionIcon, ToolIcon, ResponseIcon, GoogleSearchIcon } from './icons/Icons';

export const Sidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const blockStyle = "flex items-center p-3 mb-2 bg-gray-700 rounded-lg cursor-grab hover:bg-gray-600 hover:ring-2 hover:ring-indigo-500 transition-all duration-200";
  const iconStyle = "w-6 h-6 mr-3";
  const textStyle = "font-semibold";

  return (
    <aside className="w-72 bg-gray-800 p-4 border-r border-gray-700 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4 text-gray-300">Blocks</h2>
      
      <div draggable onDragStart={(event) => onDragStart(event, BlockType.SYSTEM)} className={blockStyle}>
        <SystemIcon className={`${iconStyle} text-indigo-400`} />
        <span className={textStyle}>System</span>
      </div>
      
      <div draggable onDragStart={(event) => onDragStart(event, BlockType.CONTEXT)} className={blockStyle}>
        <ContextIcon className={`${iconStyle} text-green-400`} />
        <span className={textStyle}>Context</span>
      </div>

       <div draggable onDragStart={(event) => onDragStart(event, BlockType.CONDITION)} className={blockStyle}>
        <ConditionIcon className={`${iconStyle} text-pink-400`} />
        <span className={textStyle}>Condition</span>
      </div>
      
      <div draggable onDragStart={(event) => onDragStart(event, BlockType.TOOL)} className={blockStyle}>
        <ToolIcon className={`${iconStyle} text-orange-400`} />
        <span className={textStyle}>Tool</span>
      </div>

       <div draggable onDragStart={(event) => onDragStart(event, BlockType.GOOGLE_SEARCH)} className={blockStyle}>
        <GoogleSearchIcon className={`${iconStyle} text-yellow-400`} />
        <span className={textStyle}>Google Search</span>
      </div>
      
      <div draggable onDragStart={(event) => onDragStart(event, BlockType.RESPONSE)} className={blockStyle}>
        <ResponseIcon className={`${iconStyle} text-cyan-400`} />
        <span className={textStyle}>Response</span>
      </div>

    </aside>
  );
};
