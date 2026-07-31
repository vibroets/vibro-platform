export const uploadToCloudinary = async (
  file: {
    uri: string;
    name: string;
    type: string;
  },
  uploadPreset: string,
  cloudName: string
): Promise<string> => {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 60000; // 60 seconds timeout

  const uploadWithTimeout = async (
    formData: FormData,
    signal: AbortSignal
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort();
    });

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const formData = new FormData();

      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

      formData.append("upload_preset", uploadPreset);

      const response = await uploadWithTimeout(formData, new AbortController().signal);

      const data = await response.json();

      if (!response.ok) {
        console.error(`Cloudinary error response (attempt ${attempt}/${MAX_RETRIES}):`, data);
        throw new Error(data?.error?.message || `Upload failed with status ${response.status}`);
      }

      console.log(`Cloudinary upload successful (attempt ${attempt}/${MAX_RETRIES})`);
      return data.secure_url;
    } catch (error: any) {
      console.error(`Cloudinary upload error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);

      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Upload failed after ${MAX_RETRIES} attempts. Last error: ${error.message}. ` +
          `Please check your internet connection and try again.`
        );
      }

      // Exponential backoff: wait 2^attempt seconds before retry
      const delayMs = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delayMs / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Upload failed unexpectedly");
};




