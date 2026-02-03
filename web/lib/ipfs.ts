// Simple IPFS upload using NFT.Storage or similar free service
// For production, use Pinata, web3.storage, or your own IPFS node

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export interface UploadResult {
  url: string;
  cid: string;
  type: "image" | "video";
}

// Convert file to base64 data URL for small files (< 500KB)
// For larger files, use a proper IPFS service
export async function uploadToIPFS(file: File): Promise<UploadResult> {
  const maxSize = 500 * 1024; // 500KB limit for data URLs
  
  if (file.size > maxSize) {
    throw new Error("File too large. Max 500KB. Use external hosting for larger files.");
  }

  const type = file.type.startsWith("image/") ? "image" : 
               file.type.startsWith("video/") ? "video" : null;
  
  if (!type) {
    throw new Error("Only images and videos are supported");
  }

  // For simplicity, we'll use data URLs for small files
  // In production, integrate with Pinata/web3.storage API
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Use the data URL directly - it will be stored in the message
      resolve({
        url: dataUrl,
        cid: "data-url",
        type,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// Detect if a message contains media
export function parseMessageContent(content: string): {
  type: "text" | "image" | "video";
  content: string;
} {
  // Check for data URLs
  if (content.startsWith("data:image/")) {
    return { type: "image", content };
  }
  if (content.startsWith("data:video/")) {
    return { type: "video", content };
  }
  
  // Check for image URLs
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi"];
  
  const lowerContent = content.toLowerCase();
  
  if (imageExtensions.some(ext => lowerContent.endsWith(ext)) ||
      lowerContent.includes("imgur.com") ||
      lowerContent.includes("i.ibb.co") ||
      content.startsWith("ipfs://")) {
    return { type: "image", content: content.replace("ipfs://", IPFS_GATEWAY) };
  }
  
  if (videoExtensions.some(ext => lowerContent.endsWith(ext)) ||
      lowerContent.includes("youtube.com") ||
      lowerContent.includes("youtu.be")) {
    return { type: "video", content };
  }
  
  return { type: "text", content };
}

// Supported file types
export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const SUPPORTED_VIDEO_TYPES = ["video/mp4", "video/webm"];
export const SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES];
