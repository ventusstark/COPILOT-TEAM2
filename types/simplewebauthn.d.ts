declare module '@simplewebauthn/server' {
  export const generateRegistrationOptions: (...args: any[]) => Promise<any>;
  export const verifyRegistrationResponse: (...args: any[]) => Promise<any>;
  export const generateAuthenticationOptions: (...args: any[]) => Promise<any>;
  export const verifyAuthenticationResponse: (...args: any[]) => Promise<any>;
}

declare module '@simplewebauthn/server/helpers' {
  export const isoBase64URL: {
    toBuffer: (value: string) => Uint8Array;
    fromBuffer: (value: Uint8Array | ArrayBuffer) => string;
  };
}
