import client from "@/lib/api/client";

// Presigned-URL image upload: ask for a URL → PUT the bytes to storage → confirm → public URL.
// resourceId can be a temp id for not-yet-created resources (mirrors the mobile kudos-media flow).
export async function uploadImage(file: Blob, resourceType: string, resourceId: string): Promise<string> {
  const fileType = file.type || "image/jpeg";

  const { data, error } = await client.GET("/v1/uploads/{resource_type}/{resource_id}/url", {
    params: { path: { resource_type: resourceType, resource_id: resourceId }, query: { file_type: fileType } },
  });
  if (error || !data) throw new Error("Couldn't start the image upload.");

  const put = await fetch(data.upload_url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": fileType, "x-amz-acl": "public-read" },
  });
  if (!put.ok) throw new Error("Image upload failed.");

  // Best-effort: the object is already public after the PUT; confirm only syncs certain
  // resource types (profile/blueprint/post) server-side and 400s for others (e.g. kudos).
  const { error: confirmError } = await client.POST("/v1/uploads/{resource_type}/{resource_id}/confirm", {
    params: { path: { resource_type: resourceType, resource_id: resourceId } },
    body: { public_url: data.public_url },
  });
  if (confirmError) console.warn("Upload confirm failed (image still uploaded):", confirmError);

  return data.public_url;
}
