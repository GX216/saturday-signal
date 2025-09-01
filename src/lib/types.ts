export type WindowKey = 'Noon' | 'Afternoon' | 'Prime' | 'Late';
export type SourceTag = 'CFBD' | 'AP' | 'Odds' | 'Computed';

export interface Game {
  id: string;
  window: WindowKey;
  kickoffET: string;
  kickoffDate?: string; // e.g., Wed, Sep 4 (ET)
  kickoffISO?: string;
  network?: string;
  confA?: string; confB?: string;
  rankA?: number; rankB?: number;
  teamA: string; teamB: string;
  spread?: number; total?: number; upsetProb?: number;
  importance: number; prospectDensity: number; watchability: number; drama: number;
  importanceSrc?: SourceTag; prospectDensitySrc?: SourceTag; watchabilitySrc?: SourceTag; dramaSrc?: SourceTag;
  lastUpdated?: string;
  prospects?: Array<{name:string; pos:string; tier:string}>;
  why?: string;
  __score?: number;
}
export interface SlateResponse { games: Game[]; demo?: boolean; updatedAt: string; }
