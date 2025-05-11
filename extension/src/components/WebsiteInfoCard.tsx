import React from "react";
import { Globe } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Typography } from "./ui/typography";

interface WebsiteInfoCardProps {
  url?: string;
  hostname?: string;
  title?: string;
  favicon?: string;
}

export const WebsiteInfoCard: React.FC<WebsiteInfoCardProps> = ({ 
  url, 
  hostname,
  title,
  favicon
}) => {
  if (!url && !hostname) {
    return null;
  }

  return (
    <Card className="mb-4 overflow-hidden border border-gray-200">
      <CardContent className="p-4 flex items-center gap-3">
        {favicon ? (
          <img 
            src={favicon} 
            alt={hostname || "Website"} 
            className="w-8 h-8 rounded-full flex-shrink-0 object-contain"
            onError={(e) => {
              // If favicon fails to load, replace with default icon
              const imgElement = e.target as HTMLImageElement;
              imgElement.style.display = 'none';
              
              if (imgElement.nextElementSibling instanceof HTMLElement) {
                imgElement.nextElementSibling.style.display = 'flex';
              }
            }} 
          />
        ) : null}
        <div className="hidden w-8 h-8 bg-blue-100 rounded-full items-center justify-center flex-shrink-0" style={{ display: favicon ? 'none' : 'flex' }}>
          <Globe className="w-5 h-5 text-blue-600" />
        </div>
        
        <div className="overflow-hidden">
          {title && (
            <Typography variant="h6" className="truncate font-medium text-gray-900">
              {title}
            </Typography>
          )}
          {hostname && (
            <Typography className="text-sm text-gray-500 truncate">
              {hostname}
            </Typography>
          )}
          {url && (
            <Typography className="text-xs text-gray-400 truncate">
              {url}
            </Typography>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 