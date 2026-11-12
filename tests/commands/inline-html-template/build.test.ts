import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import * as prompts from '@inquirer/prompts';
import { decompressInlineHtmlTemplate } from '@trustvc/trustvc';
import { afterEach, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  buildInlineTemplate,
  handler,
  promptForInputs,
} from '../../../src/commands/inline-html-template/build';

vi.mock('signale', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  Signale: vi.fn().mockImplementation(() => ({
    await: vi.fn(),
    success: vi.fn(),
  })),
}));

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
}));

const TEMPLATE_HTML = '<div data-field="name"></div>';
const TEMPLATE_CSS = '.card{color:red}';

describe('inline-template-build', () => {
  let tmpDir: tmp.DirResult;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    fs.writeFileSync(path.join(tmpDir.name, 'template.html'), TEMPLATE_HTML);
    fs.writeFileSync(path.join(tmpDir.name, 'template.css'), TEMPLATE_CSS);
  });

  afterEach(() => {
    tmpDir.removeCallback();
    vi.restoreAllMocks();
  });

  describe('promptForInputs', () => {
    it('returns the trimmed answers in order', async () => {
      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(' template.html ')
        .mockResolvedValueOnce(' template.css ')
        .mockResolvedValueOnce(' DEMO_CARD ')
        .mockResolvedValueOnce(' ./out ');

      const result = await promptForInputs();

      expect(result).toEqual({
        pathToHtml: 'template.html',
        pathToCss: 'template.css',
        templateName: 'DEMO_CARD',
        outputPath: './out',
      });
    });
  });

  describe('buildInlineTemplate', () => {
    it('compresses the html + css and writes a template that decompresses back to the originals', async () => {
      const outputPath = path.join(tmpDir.name, 'out');

      await buildInlineTemplate({
        pathToHtml: path.join(tmpDir.name, 'template.html'),
        pathToCss: path.join(tmpDir.name, 'template.css'),
        templateName: 'DEMO_CARD',
        outputPath,
      });

      const [generatedFile] = fs.readdirSync(outputPath);
      const written = JSON.parse(fs.readFileSync(path.join(outputPath, generatedFile), 'utf8'));
      expect(written.templateName).toBe('DEMO_CARD');
      expect(typeof written.template).toBe('string');

      const decompressed = await decompressInlineHtmlTemplate({
        renderMethod: { type: 'INLINE_HTML_TEMPLATE', template: written.template },
      } as never);
      const method = (decompressed as { renderMethod: { template: unknown } }).renderMethod
        .template as { templateName: string; html: string; css: string };

      expect(method).toEqual({
        templateName: 'DEMO_CARD',
        html: TEMPLATE_HTML,
        css: TEMPLATE_CSS,
      });
    });

    it('throws a clear error when the html file does not exist', async () => {
      await expect(
        buildInlineTemplate({
          pathToHtml: path.join(tmpDir.name, 'missing.html'),
          pathToCss: path.join(tmpDir.name, 'template.css'),
          templateName: 'DEMO_CARD',
          outputPath: path.join(tmpDir.name, 'out'),
        }),
      ).rejects.toThrow(/File not found/);
    });
  });

  describe('handler', () => {
    it('reports an error through signale and sets a non-zero exit code on failure', async () => {
      const signale = await import('signale');
      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(path.join(tmpDir.name, 'missing.html'))
        .mockResolvedValueOnce(path.join(tmpDir.name, 'template.css'))
        .mockResolvedValueOnce('DEMO_CARD')
        .mockResolvedValueOnce(path.join(tmpDir.name, 'out'));
      process.exitCode = undefined;

      await handler();

      expect(signale.default.error).toHaveBeenCalledWith(expect.stringMatching(/File not found/));
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
    });
  });
});
