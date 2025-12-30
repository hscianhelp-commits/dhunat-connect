import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Global variable to persist the prompt across component re-renders and page navigations
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;

export const usePwaInstall = () => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(globalDeferredPrompt);

  useEffect(() => {
    // Check if already installed (running in standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      globalDeferredPrompt = promptEvent;
      promptRef.current = promptEvent;
      setIsReady(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsReady(false);
      globalDeferredPrompt = null;
      promptRef.current = null;
    };

    // Check if prompt is already available from previous capture
    if (globalDeferredPrompt) {
      promptRef.current = globalDeferredPrompt;
      setIsReady(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (isInstalled) return;

    const prompt = promptRef.current || globalDeferredPrompt;

    if (prompt) {
      try {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        globalDeferredPrompt = null;
        promptRef.current = null;
        setIsReady(false);
      } catch (error) {
        console.error('Install error:', error);
      }
    }
    // If the browser doesn't expose an install prompt (e.g., not eligible yet),
    // we intentionally do nothing here to avoid showing alerts/instructions.

  }, [isInstalled]);

  return { 
    isInstallable: isReady && !isInstalled, 
    isInstalled, 
    installApp
  };
};
