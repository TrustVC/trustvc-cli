import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import * as prompts from '@inquirer/prompts';
import { afterEach, beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import {
  handler,
  previewInlineTemplate,
  promptForInputs,
} from '../../../src/commands/inline-html-template/preview';

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

const TEMPLATE_HTML =
  '<div data-field="name"></div><template data-repeat="items"><span data-field="label"></span></template>';
const TEMPLATE_CSS = '.card{color:red}';

describe('inline-template-preview', () => {
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
    // previewInlineTemplate must never leave a global DOMParser behind for other commands.
    expect((globalThis as { DOMParser?: unknown }).DOMParser).toBeUndefined();
  });

  describe('promptForInputs', () => {
    it('returns the trimmed answers in order, including an empty sample data path', async () => {
      (prompts.input as MockedFunction<any>)
        .mockResolvedValueOnce(' template.html ')
        .mockResolvedValueOnce(' template.css ')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(' ./preview.html ');

      const result = await promptForInputs();

      expect(result).toEqual({
        pathToHtml: 'template.html',
        pathToCss: 'template.css',
        pathToSampleData: '',
        outputPath: './preview.html',
      });
    });
  });

  describe('previewInlineTemplate', () => {
    it('fills data-field / data-repeat bindings from the sample data and writes a standalone HTML file', async () => {
      const sampleDataPath = path.join(tmpDir.name, 'sample-data.json');
      fs.writeFileSync(
        sampleDataPath,
        JSON.stringify({ name: 'Alice Tan', items: [{ label: 'A' }, { label: 'B' }] }),
      );
      const outputPath = path.join(tmpDir.name, 'preview.html');

      await previewInlineTemplate({
        pathToHtml: path.join(tmpDir.name, 'template.html'),
        pathToCss: path.join(tmpDir.name, 'template.css'),
        pathToSampleData: sampleDataPath,
        outputPath,
      });

      const srcdoc = fs.readFileSync(outputPath, 'utf8');
      expect(srcdoc).toContain('<div data-field="name">Alice Tan</div>');
      expect(srcdoc).toContain('<span data-field="label">A</span>');
      expect(srcdoc).toContain('<span data-field="label">B</span>');
      expect(srcdoc).toContain('Content-Security-Policy');
      expect(srcdoc).toContain(TEMPLATE_CSS);
    });

    it('renders with blank fields when no sample data path is given', async () => {
      const outputPath = path.join(tmpDir.name, 'preview.html');

      await previewInlineTemplate({
        pathToHtml: path.join(tmpDir.name, 'template.html'),
        pathToCss: path.join(tmpDir.name, 'template.css'),
        pathToSampleData: '',
        outputPath,
      });

      const srcdoc = fs.readFileSync(outputPath, 'utf8');
      expect(srcdoc).toContain('<div data-field="name"></div>');
    });

    it('throws a clear error when the html file does not exist', async () => {
      await expect(
        previewInlineTemplate({
          pathToHtml: path.join(tmpDir.name, 'missing.html'),
          pathToCss: path.join(tmpDir.name, 'template.css'),
          pathToSampleData: '',
          outputPath: path.join(tmpDir.name, 'preview.html'),
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
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce(path.join(tmpDir.name, 'preview.html'));
      process.exitCode = undefined;

      await handler();

      expect(signale.default.error).toHaveBeenCalledWith(expect.stringMatching(/File not found/));
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
    });
  });
});
