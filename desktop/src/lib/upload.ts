import client from "@/lib/api/client";

// Image upload = POST the bytes (base64) to the server, which resizes/re-encodes and
// stores them itself, returning a public CDN URL.
//
// We deliberately DO NOT fall back to a browser-direct presigned PUT to Spaces:
// that request is blocked by CORS in the browser and always fails with
// "Failed to fetch", so it can never succeed here — only mask the real error.

// post/blueprint images are shown large; profiles/kudos are smaller.
function variantFor(resourceType: string): string {
  switch (resourceType) {
    case "post":
    case "blueprint":
      return "large";
    default:
      return "medium";
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix — the API wants the raw payload.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Couldn't read the selected image."));
    reader.readAsDataURL(blob);
  });
}

// resourceId can be a temp id for not-yet-created resources (mirrors the mobile kudos-media flow).
export async function uploadImage(file: Blob, resourceType: string, resourceId: string): Promise<string> {
  const contentType = file.type || "image/jpeg";
  const imageData = await blobToBase64(file);

  const { data, error } = await client.POST("/v1/uploads/{resource_type}/{resource_id}/process", {
    params: {
      path: { resource_type: resourceType, resource_id: resourceId },
      query: { variant: variantFor(resourceType) },
    },
    body: { image_data: imageData, content_type: contentType },
  });

  if (error || !data?.public_url) {
    // The server rejects formats it can't decode (e.g. HEIC/some WebP). Give a real hint.
    throw new Error("Couldn't upload that image. Try a JPG or PNG.");
  }
  return data.public_url;
}
