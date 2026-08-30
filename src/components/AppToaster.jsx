import React from 'react';
import { Toaster, toast } from 'react-hot-toast';

/** Centralized toast styling so every call site gets the same look for free. */
export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: '#1C1F24', // ink-800
          color: '#F3F1EA', // paper
          border: '1px solid #282C33', // ink-700
          borderRadius: '12px',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#4FB28C', secondary: '#1C1F24' } }, // domain-podcast green
        error: { iconTheme: { primary: '#E2735A', secondary: '#1C1F24' } }, // domain-video coral
      }}
    />
  );
}

export { toast };
