import { Type } from '@google/genai';

export enum BlockType {
  SYSTEM = 'system',
  CONTEXT = 'context',
  CONDITION = 'condition',
  TOOL = 'tool',
  RESPONSE = 'response',
  GOOGLE_SEARCH = 'google_search',
}

export enum Model {
    PRO = 'gemini-2.5-pro',
    FLASH = 'gemini-2.5-flash',
    FLASH_LITE = 'gemini-2.5-flash-lite',
}

export interface NodeData {
  label: string;
  text?: string;
  condition?: string;
  toolName?: string;
  toolDescription?: string;
  toolParameters?: { key: string; description: string }[];
  responseSchema?: any;
}

// Minimal interface for Schema from @google/genai
export interface Schema {
  type: Type;
  description?: string;
  properties?: { [key: string]: Schema };
  items?: Schema;
}