
import React, { useState } from 'react';

interface PreviewPanelProps {
  json: string;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ json }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-1/2 bg-gray-800 flex flex-col border-t border-gray-700">
      <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-700">
        <h3 className="text-lg font-bold">Generated n8n Prompt (JSON)</h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>
      <div className="flex-grow p-1 overflow-auto bg-gray-900">
        <pre className="text-xs text-gray-300 whitespace-pre-wrap p-3">
          <code>{json}</code>
        </pre>
      </div>
    </div>
  );
};
