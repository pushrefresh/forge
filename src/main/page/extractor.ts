import type { WebContents } from 'electron';
import { nanoid } from 'nanoid';
import type {
  PageForm,
  PageHeading,
  PageLink,
  PageMetadata,
  PageSnapshot,
} from '@shared/types';
import { EXTRACTOR_SCRIPT } from './scripts';
import { createLogger } from '../utils/logger';

const log = createLogger('extractor');

interface RawResult {
  metadata: PageMetadata;
  headings: PageHeading[];
  links: PageLink[];
  forms: PageForm[];
  mainText: string;
  digest: string;
}

export async function extractSnapshot(
  webContents: WebContents,
  tabId: string,
  missionId: string | null,
): Promise<PageSnapshot> {
  let raw: RawResult;
  try {
    raw = (await webContents.executeJavaScript(EXTRACTOR_SCRIPT, true)) as RawResult;
  } catch (err) {
    log.warn('extractor failed; returning stub', { err: String(err) });
    raw = {
      metadata: {
        url: webContents.getURL(),
        title: webContents.getTitle(),
        description: null,
        favicon: null,
        language: null,
        siteName: null,
        ogImage: null,
      },
      headings: [],
      links: [],
      forms: [],
      mainText: '',
      digest: `URL: ${webContents.getURL()}\nTITLE: ${webContents.getTitle()}`,
    };
  }

  return {
    id: nanoid(12),
    tabId,
    missionId,
    capturedAt: new Date().toISOString(),
    metadata: raw.metadata,
    mainText: raw.mainText,
    headings: raw.headings,
    links: raw.links,
    forms: raw.forms,
    digest: raw.digest,
  };
}
