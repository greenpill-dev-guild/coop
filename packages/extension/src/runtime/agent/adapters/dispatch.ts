import { type CoopDexie, type KnowledgeSource, assertAllowedSource } from '@coop/shared';
import { parseGitHubRepoContext } from './github';
import { parseNPMPackageInfo } from './npm';
import { parseRedditPosts } from './reddit';
import { parseRSSFeed } from './rss';
import { sanitizeIngested } from './sanitizer';
import type { StructuredContent } from './types';
import { parseWikipediaArticle } from './wikipedia';
import { fetchYouTubeTranscript } from './youtube';

type SourceFetcher = (input: string) => Promise<Response>;

function ensureHttpsUrl(identifier: string): string {
  if (/^https?:\/\//i.test(identifier)) {
    return identifier;
  }
  return `https://${identifier}`;
}

function encodeWikiTitle(title: string): string {
  return encodeURIComponent(title.trim().replace(/\s+/g, '_'));
}

function normalizeSubreddit(identifier: string): string {
  const clean = identifier.replace(/^\/+/, '');
  return clean.startsWith('r/') ? clean : `r/${clean}`;
}

export function sourceToPublicUrl(source: KnowledgeSource): string {
  switch (source.type) {
    case 'youtube':
      return `https://youtube.com/${source.identifier.startsWith('@') ? source.identifier : `channel/${source.identifier}`}`;
    case 'github':
      return `https://github.com/${source.identifier}`;
    case 'rss':
      return ensureHttpsUrl(source.identifier);
    case 'reddit':
      return `https://reddit.com/${normalizeSubreddit(source.identifier)}`;
    case 'npm':
      return `https://npmjs.com/package/${source.identifier}`;
    case 'wikipedia':
      return `https://en.wikipedia.org/wiki/${encodeWikiTitle(source.identifier)}`;
  }
}

function sourceToFetchUrl(source: KnowledgeSource): string {
  switch (source.type) {
    case 'youtube':
      return `https://youtube.com/${source.identifier.startsWith('@') ? source.identifier : `channel/${source.identifier}`}/transcript.json`;
    case 'github':
      return `https://api.github.com/repos/${source.identifier}`;
    case 'rss':
      return ensureHttpsUrl(source.identifier);
    case 'reddit':
      return `https://www.reddit.com/${normalizeSubreddit(source.identifier)}/hot.json`;
    case 'npm':
      return `https://registry.npmjs.org/${encodeURIComponent(source.identifier)}`;
    case 'wikipedia':
      return `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeWikiTitle(
        source.identifier,
      )}&format=json&prop=text|categories|sections`;
  }
}

async function assertOk(response: Response, source: KnowledgeSource): Promise<Response> {
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${source.type}:${source.identifier} (${response.status.toString()})`,
    );
  }
  return response;
}

function sanitizeStructuredContent(content: StructuredContent): StructuredContent {
  return {
    ...content,
    body: sanitizeIngested(content.body),
  };
}

export async function fetchStructuredContentForSource(input: {
  db: CoopDexie;
  source: KnowledgeSource;
  fetcher?: SourceFetcher;
}): Promise<StructuredContent[]> {
  const fetcher = input.fetcher ?? ((url: string) => fetch(url));
  await assertAllowedSource(
    input.db,
    sourceToPublicUrl(input.source),
    input.source.type,
    input.source.coopId,
  );

  const response = await assertOk(await fetcher(sourceToFetchUrl(input.source)), input.source);

  switch (input.source.type) {
    case 'youtube':
      return [sanitizeStructuredContent(await fetchYouTubeTranscript(await response.json()))];
    case 'github':
      return [
        sanitizeStructuredContent(
          parseGitHubRepoContext(await response.json(), input.source.identifier),
        ),
      ];
    case 'rss':
      return parseRSSFeed(
        await response.text(),
        input.source.identifier,
        input.source.lastFetchedAt ?? undefined,
      ).map(sanitizeStructuredContent);
    case 'reddit':
      return parseRedditPosts(
        await response.json(),
        normalizeSubreddit(input.source.identifier),
      ).map(sanitizeStructuredContent);
    case 'npm':
      return [
        sanitizeStructuredContent(
          parseNPMPackageInfo(await response.json(), input.source.identifier),
        ),
      ];
    case 'wikipedia':
      return [
        sanitizeStructuredContent(
          parseWikipediaArticle(await response.json(), input.source.identifier),
        ),
      ];
  }
}
