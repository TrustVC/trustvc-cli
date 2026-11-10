import fs from 'fs';
import path from 'path';
import { input } from '@inquirer/prompts';
import { JSDOM } from 'jsdom';
import signale from 'signale';
import { buildInlineHtmlTemplateSrcdoc } from '@trustvc/trustvc';
import {
  ensureInputFileExists,
  getCliErrorMessage,
  readFile,
  readJsonFile,
  validateInputFileExists,
} from '../../utils';
import { InlineTemplatePreviewInput } from '../../types';

export const command = 'inline-template-preview';
export const describe =
  'Render a template against sample data into a standalone HTML file, to check data-field / data-field-src / data-repeat bindings before compressing it';

const PREVIEW_ERROR_OPTIONS = {
  defaultMessage: 'An unexpected error occurred while previewing the inline HTML template.',
  fileNotFound: 'Unable to read file. File not found at: {path}',
  permissionDenied: 'Permission denied. Cannot write to: {path}',
  invalidJson: (msg: string) => `Invalid sample data file: the file is not valid JSON. ${msg}`,
} as const;

// buildInlineHtmlTemplateSrcdoc only reads template.html / template.css; the name has no
// effect on the rendered preview.
const PREVIEW_TEMPLATE_NAME = 'PREVIEW';

export const promptForInputs = async (): Promise<InlineTemplatePreviewInput> => {
  const pathToHtml = await input({
    message: 'Enter the path to your template HTML file:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Template HTML file path is required';
      return validateInputFileExists(value);
    },
  });

  const pathToCss = await input({
    message: 'Enter the path to your template CSS file:',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Template CSS file path is required';
      return validateInputFileExists(value);
    },
  });

  const pathToSampleData = await input({
    message:
      'Enter the path to a sample credentialSubject JSON file (optional, leave blank to preview with no data):',
    default: '',
    validate: (value: string) => {
      if (!value || value.trim() === '') return true;
      return validateInputFileExists(value);
    },
  });

  const outputPath = await input({
    message: 'Enter a path to save the preview HTML file:',
    default: './inline-template-preview.html',
    required: true,
  });

  return {
    pathToHtml: pathToHtml.trim(),
    pathToCss: pathToCss.trim(),
    pathToSampleData: pathToSampleData.trim(),
    outputPath: outputPath.trim(),
  };
};

/**
 * trustvc's rendering helpers assume a browser's `DOMParser` (bare fragment HTML normalises
 * into `document.body`, matching how the real sandboxed iframe parses it). Node has no global
 * DOMParser, so one is installed for the duration of the call and removed straight after —
 * never left as global state for other commands.
 */
const withDomParser = async <T>(fn: () => T): Promise<T> => {
  const target = globalThis as { DOMParser?: unknown };
  const previous = target.DOMParser;
  target.DOMParser = new JSDOM().window.DOMParser;
  try {
    return fn();
  } finally {
    target.DOMParser = previous;
  }
};

/** Fills the template against sample data (or no data) and writes the result as a standalone HTML file. */
export const previewInlineTemplate = async (answers: InlineTemplatePreviewInput): Promise<void> => {
  const { pathToHtml, pathToCss, pathToSampleData, outputPath } = answers;

  ensureInputFileExists(pathToHtml);
  ensureInputFileExists(pathToCss);

  const html = readFile(pathToHtml);
  const css = readFile(pathToCss);

  let credentialSubject: Record<string, unknown> = {};
  if (pathToSampleData) {
    ensureInputFileExists(pathToSampleData);
    credentialSubject = readJsonFile<Record<string, unknown>>(pathToSampleData, 'sample data');
  }

  const srcdoc = await withDomParser(() =>
    buildInlineHtmlTemplateSrcdoc({
      renderMethod: {
        type: 'INLINE_HTML_TEMPLATE',
        template: { templateName: PREVIEW_TEMPLATE_NAME, html, css },
      },
      credentialSubject,
    }),
  );

  if (!srcdoc) {
    throw new Error('Could not render the template preview.');
  }

  const outputFilePath = path.resolve(outputPath);
  const dir = path.dirname(outputFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputFilePath, srcdoc, 'utf8');

  signale.success(`Preview saved to: ${outputFilePath}`);
  signale.info(
    'Open it in a browser to check data-field / data-field-src / data-repeat bindings before running inline-template-build.',
  );
};

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await previewInlineTemplate(answers);
  } catch (err: unknown) {
    signale.error(getCliErrorMessage(err, PREVIEW_ERROR_OPTIONS));
    process.exitCode = 1;
  }
};
