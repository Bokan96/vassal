/// <reference lib="webworker" />
import { chooseMove, type AiLevel, type BotResult } from './bots.ts';
import type { PlayerView } from '../engine/index.ts';

export interface AiRequest {
  id: number;
  view: PlayerView;
  level: AiLevel;
  seed: number;
  budgetMs: number;
}

export type AiResponse =
  { id: number; ok: true; result: BotResult } | { id: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, view, level, seed, budgetMs } = e.data;
  let response: AiResponse;
  try {
    response = { id, ok: true, result: chooseMove(view, level, { seed, budgetMs }) };
  } catch (err) {
    response = { id, ok: false, error: (err as Error).message };
  }
  self.postMessage(response);
};
