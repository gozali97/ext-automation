// Model credits mapping for different AI tools and modes

// Type definitions
export type ImageGeneratorMode = 
  | 'flux-fast' 
  | 'flux' 
  | 'flux-realism' 
  | 'flux-dev' // Likely Flux 1.1
  | 'mystic' 
  | 'mystic-2-5' 
  | 'mystic-2-5-flexible' 
  | 'classic-fast'
  | 'classic'
  | 'imagen3'
  | 'ideogram';

export type ToolType = 
  | 'text-to-image'
  | 'custom-lora-character-high'
  | 'custom-lora-character-ultra'
  | 'custom-lora-product-high'
  | 'custom-lora-product-ultra'
  | 'custom-lora-style-medium'
  | 'custom-lora-style-high'
  | 'custom-lora-style-ultra'
  | 'svg-download'
  | 'style-reference-flux'
  | 'style-reference-mystic'
  | 'sketch-to-image'
  | 'designer-text-to-image'
  | 'designer-background-remover'
  | 'upscaler-normal'
  | 'upscaler-large'
  | 'reimagine-classic-fast'
  | 'reimagine-flux'
  | 'retouch-erase'
  | 'retouch-replace-prompt-auto'
  | 'retouch-replace-prompt-pro'
  | 'retouch-replace-image-auto'
  | 'retouch-replace-image-pro'
  | 'retouch-replace-character'
  | 'background-remover'
  | 'background-replace'
  | 'expand-classic'
  | 'expand-pro'
  | 'expand-fast';

// Main interface for the model credits
export interface ModelCredits {
  tool: ToolType;
  mode: string;
  creditsPerUsage: number;
  description?: string;
}

// Image Generator models with their credit costs
export const imageGeneratorCredits: ModelCredits[] = [
  { tool: 'text-to-image', mode: 'flux-fast', creditsPerUsage: 5, description: 'Flux 1.0 Fast' },
  { tool: 'text-to-image', mode: 'flux', creditsPerUsage: 40, description: 'Flux 1.0' },
  { tool: 'text-to-image', mode: 'flux-realism', creditsPerUsage: 40, description: 'Flux 1.0 Realism' },
  { tool: 'text-to-image', mode: 'flux-dev', creditsPerUsage: 50, description: 'Flux 1.1' },
  { tool: 'text-to-image', mode: 'mystic', creditsPerUsage: 45, description: 'Mystic' },
  { tool: 'text-to-image', mode: 'mystic-2-5', creditsPerUsage: 50, description: 'Mystic 2.5' },
  { tool: 'text-to-image', mode: 'mystic-2-5-flexible', creditsPerUsage: 80, description: 'Mystic 2.5 Flexible (Premium+ only)' },
  { tool: 'text-to-image', mode: 'classic-fast', creditsPerUsage: 1, description: 'Classic Fast' },
  { tool: 'text-to-image', mode: 'classic', creditsPerUsage: 5, description: 'Classic' },
  { tool: 'text-to-image', mode: 'imagen3', creditsPerUsage: 50, description: 'Google Imagen 3' },
  { tool: 'text-to-image', mode: 'ideogram', creditsPerUsage: 60, description: 'Ideogram' },
];

// Custom LoRA training
export const customLoraCredits: ModelCredits[] = [
  { tool: 'custom-lora-character-high', mode: 'high', creditsPerUsage: 5500, description: 'Custom Character High' },
  { tool: 'custom-lora-character-ultra', mode: 'ultra', creditsPerUsage: 5500, description: 'Custom Character Ultra' },
  { tool: 'custom-lora-product-high', mode: 'high', creditsPerUsage: 5500, description: 'Custom Product High' },
  { tool: 'custom-lora-product-ultra', mode: 'ultra', creditsPerUsage: 5500, description: 'Custom Product Ultra' },
  { tool: 'custom-lora-style-medium', mode: 'medium', creditsPerUsage: 2300, description: 'Custom Style Medium' },
  { tool: 'custom-lora-style-high', mode: 'high', creditsPerUsage: 5500, description: 'Custom Style High' },
  { tool: 'custom-lora-style-ultra', mode: 'ultra', creditsPerUsage: 5500, description: 'Custom Style Ultra' },
];

// Download
export const downloadCredits: ModelCredits[] = [
  { tool: 'svg-download', mode: 'svg', creditsPerUsage: 150, description: 'SVG Download' },
];

// Style Reference
export const styleReferenceCredits: ModelCredits[] = [
  { tool: 'style-reference-flux', mode: 'flux', creditsPerUsage: 80, description: 'Style Reference Flux 1.0' },
  { tool: 'style-reference-mystic', mode: 'mystic-2-5', creditsPerUsage: 100, description: 'Style Reference Mystic 2.5' },
];

// Other AI Tools
export const otherToolsCredits: ModelCredits[] = [
  { tool: 'sketch-to-image', mode: 'default', creditsPerUsage: 1, description: 'Sketch to Image' },
  { tool: 'designer-text-to-image', mode: 'default', creditsPerUsage: 1, description: 'Designer Text to Image' },
  { tool: 'designer-background-remover', mode: 'default', creditsPerUsage: 3, description: 'Designer Background Remover' },
  { tool: 'upscaler-normal', mode: 'normal', creditsPerUsage: 72, description: 'Upscaler Normal' },
  { tool: 'upscaler-large', mode: 'large', creditsPerUsage: 216, description: 'Upscaler Large' },
  { tool: 'reimagine-classic-fast', mode: 'classic-fast', creditsPerUsage: 1, description: 'Reimagine Classic Fast' },
  { tool: 'reimagine-flux', mode: 'flux', creditsPerUsage: 5, description: 'Reimagine Flux' },
  { tool: 'retouch-erase', mode: 'erase', creditsPerUsage: 25, description: 'Retouch Erase' },
  { tool: 'retouch-replace-prompt-auto', mode: 'replace-prompt-auto', creditsPerUsage: 60, description: 'Retouch Replace Prompt Auto' },
  { tool: 'retouch-replace-prompt-pro', mode: 'replace-prompt-pro', creditsPerUsage: 80, description: 'Retouch Replace Prompt Pro' },
  { tool: 'retouch-replace-image-auto', mode: 'replace-image-auto', creditsPerUsage: 60, description: 'Retouch Replace Image Auto' },
  { tool: 'retouch-replace-image-pro', mode: 'replace-image-pro', creditsPerUsage: 80, description: 'Retouch Replace Image Pro' },
  { tool: 'retouch-replace-character', mode: 'replace-character', creditsPerUsage: 70, description: 'Retouch Replace Character' },
  { tool: 'background-remover', mode: 'default', creditsPerUsage: 3, description: 'Background Remover' },
  { tool: 'background-replace', mode: 'default', creditsPerUsage: 15, description: 'Background Replace' },
  { tool: 'expand-classic', mode: 'classic', creditsPerUsage: 40, description: 'Expand Classic' },
  { tool: 'expand-pro', mode: 'pro', creditsPerUsage: 80, description: 'Expand Pro' },
  { tool: 'expand-fast', mode: 'fast', creditsPerUsage: 20, description: 'Expand Fast' },
];

// Combine all credits into a single array
export const allModelCredits: ModelCredits[] = [
  ...imageGeneratorCredits,
  ...customLoraCredits,
  ...downloadCredits,
  ...styleReferenceCredits,
  ...otherToolsCredits
];

// Function to get credits needed for a specific tool and mode
export function getCreditsForUsage(tool: ToolType, mode: string): number | undefined {
  const modelCredit = allModelCredits.find(credit => credit.tool === tool && credit.mode === mode);
  return modelCredit?.creditsPerUsage;
}

// Function to parse API payload from string
export function parseApiPayload(payloadStr: string): { generations?: number; mode?: string; tool?: ToolType } | null {
  try {
    // Try to find a JSON object in the string that contains mode and tool
    const matches = payloadStr.match(/\{[^{}]*"mode"[^{}]*"tool"[^{}]*\}|\{[^{}]*"tool"[^{}]*"mode"[^{}]*\}/);
    if (!matches) return null;
    
    const payload = JSON.parse(matches[0]);
    return {
      generations: payload.generations || 1,
      mode: payload.mode,
      tool: payload.tool as ToolType
    };
  } catch (e) {
    console.error('Error parsing API payload:', e);
    return null;
  }
}

// Function to calculate total credits for a request
export function calculateTotalCredits(payload: { generations?: number; mode?: string; tool?: ToolType }): number {
  if (!payload.mode || !payload.tool) return 0;
  
  const creditsPerUsage = getCreditsForUsage(payload.tool, payload.mode);
  if (!creditsPerUsage) return 0;
  
  return creditsPerUsage * (payload.generations || 1);
}
