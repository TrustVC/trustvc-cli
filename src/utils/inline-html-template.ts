import { compressTemplate } from '@trustvc/trustvc';
import { ensureInputFileExists, readFile } from './file-io';

export type InlineTemplateFiles = {
  pathToHtml: string;
  pathToCss: string;
  templateName: string;
};

/**
 * Reads a raw HTML + CSS template pair and compresses them into the string an
 * `INLINE_HTML_TEMPLATE` renderMethod entry (and `DocumentBuilder.inlineHtmlTemplate()`) expects.
 */
export async function compressTemplateFromFiles({
  pathToHtml,
  pathToCss,
  templateName,
}: InlineTemplateFiles): Promise<string> {
  ensureInputFileExists(pathToHtml);
  ensureInputFileExists(pathToCss);

  const html = readFile(pathToHtml);
  const css = readFile(pathToCss);

  return compressTemplate({ templateName, html, css });
}
