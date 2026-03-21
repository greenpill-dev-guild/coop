const webAuthnBridgeMessageType = 'coop-internal-request-webauthn-credential';

type WebAuthnBridgeRequest = {
  type: typeof webAuthnBridgeMessageType;
  payload?: SerializedCredentialRequestOptions;
};

type SerializedCredentialRequestOptions = {
  publicKey?: Omit<PublicKeyCredentialRequestOptions, 'allowCredentials' | 'challenge'> & {
    allowCredentials?: Array<
      Omit<PublicKeyCredentialDescriptor, 'id'> & {
        id: number[];
      }
    >;
    challenge: number[];
  };
};

type SerializedAssertionCredential = {
  id: string;
  response: {
    authenticatorData: number[];
    clientDataJSON: number[];
    signature: number[];
    userHandle: number[] | null;
  };
};

type WebAuthnBridgeResponse =
  | {
      ok: true;
      data: SerializedAssertionCredential | null;
    }
  | {
      ok: false;
      error: string;
    };

function isWebAuthnBridgeRequest(message: unknown): message is WebAuthnBridgeRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as { type?: string }).type === webAuthnBridgeMessageType
  );
}

function serializeAssertionCredential(
  credential: Credential | null,
): SerializedAssertionCredential | null {
  if (!credential) {
    return null;
  }

  const assertion = credential as PublicKeyCredential;
  const response = assertion.response as AuthenticatorAssertionResponse;

  return {
    id: assertion.id,
    response: {
      authenticatorData: Array.from(new Uint8Array(response.authenticatorData)),
      clientDataJSON: Array.from(new Uint8Array(response.clientDataJSON)),
      signature: Array.from(new Uint8Array(response.signature)),
      userHandle: response.userHandle ? Array.from(new Uint8Array(response.userHandle)) : null,
    },
  };
}

function serializeCredentialRequestOptions(
  options?: CredentialRequestOptions,
): SerializedCredentialRequestOptions | undefined {
  if (!options?.publicKey) {
    return options;
  }

  return {
    publicKey: {
      ...options.publicKey,
      allowCredentials: options.publicKey.allowCredentials?.map((credential) => ({
        ...credential,
        id: Array.from(new Uint8Array(credential.id)),
      })),
      challenge: Array.from(new Uint8Array(options.publicKey.challenge)),
    },
  };
}

function deserializeCredentialRequestOptions(
  options?: SerializedCredentialRequestOptions,
): CredentialRequestOptions | undefined {
  if (!options?.publicKey) {
    return options;
  }

  return {
    publicKey: {
      ...options.publicKey,
      allowCredentials: options.publicKey.allowCredentials?.map((credential) => ({
        ...credential,
        id: Uint8Array.from(credential.id),
      })),
      challenge: Uint8Array.from(options.publicKey.challenge),
    },
  };
}

function deserializeAssertionCredential(
  credential: SerializedAssertionCredential | null,
): Credential | null {
  if (!credential) {
    return null;
  }

  return {
    id: credential.id,
    response: {
      authenticatorData: Uint8Array.from(credential.response.authenticatorData).buffer,
      clientDataJSON: Uint8Array.from(credential.response.clientDataJSON).buffer,
      signature: Uint8Array.from(credential.response.signature).buffer,
      userHandle: credential.response.userHandle
        ? Uint8Array.from(credential.response.userHandle).buffer
        : null,
    },
  } as Credential;
}

export async function requestWebAuthnCredentialViaExtensionBridge(
  options?: CredentialRequestOptions,
) {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: webAuthnBridgeMessageType,
      payload: serializeCredentialRequestOptions(options),
    } satisfies WebAuthnBridgeRequest)) as WebAuthnBridgeResponse | undefined;

    if (!response?.ok) {
      throw new Error(
        response?.error ??
          'Passkey confirmation requires an open Coop popup or sidepanel on this browser.',
      );
    }

    return deserializeAssertionCredential(response.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Passkey confirmation is unavailable.';
    throw new Error(message);
  }
}

export function registerWebAuthnCredentialBridge() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isWebAuthnBridgeRequest(message)) {
      return;
    }

    if (sender.id && sender.id !== chrome.runtime.id) {
      sendResponse({
        ok: false,
        error: 'Unauthorized WebAuthn bridge sender.',
      } satisfies WebAuthnBridgeResponse);
      return;
    }

    void (async () => {
      try {
        const credential = await navigator.credentials.get(
          deserializeCredentialRequestOptions(message.payload),
        );
        sendResponse({
          ok: true,
          data: serializeAssertionCredential(credential),
        } satisfies WebAuthnBridgeResponse);
      } catch (error) {
        sendResponse({
          ok: false,
          error:
            error instanceof Error ? error.message : 'Passkey confirmation failed unexpectedly.',
        } satisfies WebAuthnBridgeResponse);
      }
    })();

    return true;
  });
}
