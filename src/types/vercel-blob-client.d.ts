declare module "@vercel/blob/client" {
  export type HandleUploadBody = Record<string, unknown>;

  export type HandleUploadConfig = {
    request: Request;
    body: HandleUploadBody;
    onBeforeGenerateToken?: (
      pathname: string,
      clientPayload: string | null,
      multipart: boolean,
    ) =>
      | Promise<{
          allowedContentTypes?: string[];
          maximumSizeInBytes?: number;
          addRandomSuffix?: boolean;
          tokenPayload?: string;
        }>
      | {
          allowedContentTypes?: string[];
          maximumSizeInBytes?: number;
          addRandomSuffix?: boolean;
          tokenPayload?: string;
        };
    onUploadCompleted?: (payload: {
      blob: { url: string };
      tokenPayload?: string | null;
    }) => Promise<void> | void;
  };

  export function handleUpload(config: HandleUploadConfig): Promise<{
    url: string;
  }>;

  export function upload(
    pathname: string,
    file: Blob | File | ArrayBuffer | ArrayBufferView | Buffer,
    options?: Record<string, unknown>,
  ): Promise<{
    url: string;
  }>;
}
