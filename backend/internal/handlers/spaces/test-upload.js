// test-upload.js
// Usage: node test-upload.js

const BACKEND_BASE_URL = 'http://localhost:8080'; // Change to your backend URL if needed
const RESOURCE_TYPE = 'test';
const RESOURCE_ID = '507f1f77bcf86cd799439011';
const FILE_TYPE = 'image/jpeg';
const IMAGE_API_URL = 'https://picsum.photos/200';

async function main() {
	// 1. Fetch a random image from the API
	console.log('Fetching image from API...');
	const imageRes = await fetch(IMAGE_API_URL);
	if (!imageRes.ok) throw new Error('Failed to fetch image');
	const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

	// 2. Get a presigned upload URL from your backend
	console.log('Requesting presigned upload URL...');
	const presignRes = await fetch(
		`${BACKEND_BASE_URL}/v1/uploads/${RESOURCE_TYPE}/${RESOURCE_ID}/url?file_type=${encodeURIComponent(FILE_TYPE)}`,
	);
	if (!presignRes.ok) throw new Error('Failed to get presigned upload URL');
	const { upload_url, public_url } = await presignRes.json();

	// 3. Upload the image to Digital Ocean Spaces
	console.log('Uploading image to Spaces...');
	const uploadRes = await fetch(upload_url, {
		method: 'PUT',
		body: imageBuffer,
		headers: {
			'Content-Type': FILE_TYPE,
			'x-amz-acl': 'public-read',
		},
	});
	if (!uploadRes.ok) throw new Error('Failed to upload image to Spaces');
	console.log('Upload successful!');

	// 4. Confirm the upload with your backend
	console.log('Confirming upload with backend...');
	const confirmRes = await fetch(`${BACKEND_BASE_URL}/v1/uploads/${RESOURCE_TYPE}/${RESOURCE_ID}/confirm`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ public_url }),
	});
	if (!confirmRes.ok) throw new Error('Failed to confirm upload');
	const confirmData = await confirmRes.json();
	console.log('Upload confirmed:', confirmData);

	// 5. Output the public URL
	console.log('Image is now available at:', public_url);
}

main().catch((err) => {
	console.error('Test failed:', err);
	process.exit(1);
});
