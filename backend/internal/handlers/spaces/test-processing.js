// test-processing.js
// Test script for the new image processing endpoint
// Usage: bun test-processing.js

const BACKEND_BASE_URL = 'http://localhost:8080'; // Change to your backend URL if needed
const RESOURCE_TYPE = 'profile';
const RESOURCE_ID = '507f1f77bcf86cd799439011';
const VARIANT = 'medium';
const IMAGE_API_URL = 'https://picsum.photos/800/600.jpg';

async function main() {
    console.log('🚀 Testing new image processing endpoint...\n');

    // 1. Fetch a random image from the API
    console.log('📥 Fetching test image from API...');
    const imageRes = await fetch(IMAGE_API_URL);
    if (!imageRes.ok) throw new Error('Failed to fetch image');
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    console.log(`✅ Downloaded ${imageBuffer.length} bytes`);

    // 2. Convert to base64
    console.log('🔄 Converting image to base64...');
    const base64Data = imageBuffer.toString('base64');
    console.log(`✅ Converted to base64 (${base64Data.length} characters)`);

    // 3. Test the new processing endpoint
    console.log('🎨 Processing and uploading image...');
    const processRes = await fetch(
        `${BACKEND_BASE_URL}/v1/uploads/${RESOURCE_TYPE}/${RESOURCE_ID}/process?variant=${VARIANT}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_data: base64Data,
                content_type: 'image/jpeg'
            })
        }
    );

    if (!processRes.ok) {
        const errorText = await processRes.text();
        console.error('❌ Processing failed:', processRes.status, processRes.statusText);
        console.error('Error details:', errorText);
        throw new Error('Failed to process image');
    }

    const processData = await processRes.json();
    console.log('✅ Image processed successfully!');
    console.log('📊 Processing results:');
    console.log(`   • Public URL: ${processData.public_url}`);
    console.log(`   • Dimensions: ${processData.width}x${processData.height}px`);
    console.log(`   • File size: ${Math.round(processData.size / 1024)}KB`);
    console.log(`   • Format: ${processData.format}`);
    console.log(`   • Processed at: ${processData.processed_at}`);

    // 4. Test if the image is accessible
    console.log('\n🌐 Testing image accessibility...');
    const testRes = await fetch(processData.public_url, { method: 'HEAD' });
    if (testRes.ok) {
        console.log('✅ Image is publicly accessible!');
        console.log(`   • Content-Type: ${testRes.headers.get('content-type')}`);
        console.log(`   • Content-Length: ${testRes.headers.get('content-length')} bytes`);
    } else {
        console.log('⚠️  Image might not be immediately accessible (CDN propagation delay)');
    }

    console.log('\n🎉 Test completed successfully!');
    console.log(`\n🔗 Your processed image: ${processData.public_url}`);
}

// Also test the legacy endpoint for comparison
async function testLegacyEndpoint() {
    console.log('\n📋 Testing legacy upload endpoint for comparison...');
    
    try {
        // Get presigned URL
        const presignRes = await fetch(
            `${BACKEND_BASE_URL}/v1/uploads/${RESOURCE_TYPE}/${RESOURCE_ID}/url?file_type=image/jpeg`
        );
        
        if (presignRes.ok) {
            const { upload_url, public_url } = await presignRes.json();
            console.log('✅ Legacy endpoint working - got presigned URL');
            console.log(`   • Upload URL: ${upload_url.substring(0, 50)}...`);
            console.log(`   • Public URL: ${public_url}`);
        } else {
            console.log('⚠️  Legacy endpoint returned:', presignRes.status);
        }
    } catch (error) {
        console.log('⚠️  Legacy endpoint test failed:', error.message);
    }
}

// Run both tests
main()
    .then(() => testLegacyEndpoint())
    .catch((err) => {
        console.error('\n❌ Test failed:', err.message);
        process.exit(1);
    });
