import signale from 'signale';
import {
  isWrappedV2Document,
  isWrappedV3Document,
  SignedVerifiableCredential,
  verifyOASignature,
  verifyW3CSignature,
  deriveW3C,
  vc,
} from '@trustvc/trustvc';

/**
 * Verifies the signature of a document (W3C or OpenAttestation).
 * Throws an error if the document signature is invalid.
 *
 * @param document - The document to verify
 * @throws Error if document signature verification fails
 */
export const verifyDocumentSignature = async (
  document: SignedVerifiableCredential,
): Promise<void> => {
  signale.info('Verifying document signature...');

  const isOpenAttestation = isWrappedV2Document(document) || isWrappedV3Document(document);
  let verificationResult: boolean;

  try {
    if (isOpenAttestation) {
      verificationResult = await verifyOASignature(document);
    } else if (vc.isSignedDocument(document) || vc.isRawDocument(document)) {
      const verificationValue = await verifyW3CSignature(document);

      // Handle derivation if needed
      if (
        !verificationValue.verified &&
        verificationValue.error?.includes('Use deriveCredential() first')
      ) {
        const derivedCredential = await deriveW3C(document, []);
        verificationResult =
          derivedCredential && derivedCredential.derived
            ? (await verifyW3CSignature(derivedCredential.derived)).verified
            : false;
      } else {
        verificationResult = verificationValue.verified;
      }
    } else throw new Error('Document cannot be verified');

    if (!verificationResult) {
      throw new Error('Document signature verification failed: Document is tampered');
    }

    signale.success('Document signature verified successfully');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Document verification failed: Unknown error');
  }
};
