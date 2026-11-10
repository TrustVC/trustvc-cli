import { input } from '@inquirer/prompts';
import signale from 'signale';
import {
  compressTemplateFromFiles,
  getCliErrorMessage,
  resolveOutputJsonPath,
  validateInputFileExists,
  writeFile,
} from '../../utils';
import { InlineTemplateBuildInput } from '../../types';

export const command = 'inline-template-build';
export const describe =
  'Compress a raw HTML + CSS template into the string DocumentBuilder.inlineHtmlTemplate() expects';

const BUILD_ERROR_OPTIONS = {
  defaultMessage: 'An unexpected error occurred while building the inline HTML template.',
  fileNotFound: 'Unable to read template file. File not found at: {path}',
  permissionDenied: 'Permission denied. Cannot write to: {path}',
} as const;

export const promptForInputs = async (): Promise<InlineTemplateBuildInput> => {
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

  const templateName = await input({
    message: 'Enter a name for this template (e.g. BILL_OF_LADING):',
    required: true,
    validate: (value: string) => {
      if (!value || value.trim() === '') return 'Template name is required';
      return true;
    },
  });

  const outputPath = await input({
    message: 'Enter a path (or directory) to save the compressed template:',
    default: '.',
    required: true,
  });

  return {
    pathToHtml: pathToHtml.trim(),
    pathToCss: pathToCss.trim(),
    templateName: templateName.trim(),
    outputPath: outputPath.trim(),
  };
};

/** Reads the raw HTML + CSS, compresses them, and writes the artifact DocumentBuilder.inlineHtmlTemplate() expects. */
export const buildInlineTemplate = async (answers: InlineTemplateBuildInput): Promise<void> => {
  const { pathToHtml, pathToCss, templateName, outputPath } = answers;

  const template = await compressTemplateFromFiles({ pathToHtml, pathToCss, templateName });

  const { path: outputFilePath, generated } = resolveOutputJsonPath(outputPath, 'inline-template');
  writeFile(outputFilePath, { templateName, template }, true);

  if (generated) {
    signale.success(`No output filename provided. Compressed template saved to: ${outputFilePath}`);
  } else {
    signale.success(`Compressed template saved to: ${outputFilePath}`);
  }

  console.log('');
  signale.info(
    'Pass the "template" field to DocumentBuilder.inlineHtmlTemplate(template) before signing, or run "trustvc w3c-sign" and attach it as a rendering method when prompted:',
  );
  console.log(template);
};

export const handler = async (): Promise<void> => {
  try {
    const answers = await promptForInputs();
    if (!answers) return;
    await buildInlineTemplate(answers);
  } catch (err: unknown) {
    signale.error(getCliErrorMessage(err, BUILD_ERROR_OPTIONS));
    process.exitCode = 1;
  }
};
